const {
  docClient, tables,
  GetCommand, PutCommand, UpdateCommand, DeleteCommand, QueryCommand, ScanCommand,
} = require("../config");
const {
  uuid, nowIso, attachSave, project, Query, finalize, DuplicateKeyError,
  registerPopulateResolver,
} = require("./_base");

const TABLE = tables.products;

function decorate(item) {
  if (!item) return null;
  if (item.id && !item._id) item._id = item.id;
  return attachSave(item, TABLE, docClient, PutCommand);
}

function matchesFilter(item, filter) {
  if (!filter) return true;
  for (const [key, cond] of Object.entries(filter)) {
    if (key === "$or" || key === "$and") continue;
    if (cond && typeof cond === "object") {
      if ("$ne" in cond && item[key] === cond.$ne) return false;
      if ("$gt" in cond && !(item[key] > cond.$gt)) return false;
      if ("$gte" in cond && !(item[key] >= cond.$gte)) return false;
      if ("$lt" in cond && !(item[key] < cond.$lt)) return false;
      if ("$lte" in cond && !(item[key] <= cond.$lte)) return false;
      if (cond.$regex) {
        const re = new RegExp(cond.$regex, cond.$options || "");
        if (typeof item[key] !== "string" || !re.test(item[key])) return false;
      }
    } else {
      if (item[key] !== cond) return false;
    }
  }
  if (Array.isArray(filter.$or)) {
    if (!filter.$or.some((sub) => matchesFilter(item, sub))) return false;
  }
  return true;
}

async function scanAll(extraFilter) {
  const items = [];
  let ExclusiveStartKey;
  do {
    const out = await docClient.send(new ScanCommand({
      TableName: TABLE,
      ...(ExclusiveStartKey && { ExclusiveStartKey }),
    }));
    if (out.Items) items.push(...out.Items);
    ExclusiveStartKey = out.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return extraFilter ? items.filter((it) => matchesFilter(it, extraFilter)) : items;
}

function Product(data) {
  if (!(this instanceof Product)) return new Product(data);
  Object.assign(this, data || {});
  if (!this.id) this.id = uuid();
  this._id = this.id;
  return decorate(this);
}

Product.findById = async function (id) {
  if (!id) return null;
  const out = await docClient.send(new GetCommand({ TableName: TABLE, Key: { id: String(id) } }));
  return decorate(out.Item || null);
};

Product.findOne = function (filter = {}) {
  return new Query(async (opts) => {
    if (filter.product_id !== undefined && typeof filter.product_id !== "object") {
      const out = await docClient.send(new QueryCommand({
        TableName: TABLE,
        IndexName: "product_id-index",
        KeyConditionExpression: "product_id = :pid",
        ExpressionAttributeValues: { ":pid": filter.product_id },
        Limit: 1,
      }));
      const item = decorate(out.Items?.[0] || null);
      return opts?.select ? project(item, opts.select) : item;
    }
    const items = await scanAll(filter);
    let result = items.map(decorate);
    result = await finalize(result, opts);
    return result[0] || null;
  });
};

Product.find = function (filter = {}) {
  return new Query(async (opts) => {
    const items = await scanAll(filter);
    let result = items.map(decorate);
    result = await finalize(result, opts);
    return result;
  });
};

Product.create = async function (data) {
  if (data.category) {
    const Category = require("./Category");
    const exists = await Category.exists({ name: data.category });
    if (!exists) {
      const err = new Error(`Category "${data.category}" does not exist. Add it first or pick an existing one.`);
      err.code = "ValidationError";
      throw err;
    }
  }
  if (data.product_id !== undefined) {
    const existing = await Product.findOne({ product_id: data.product_id });
    if (existing) throw new DuplicateKeyError(`product_id ${data.product_id} already exists`);
  }
  const id = data.id || uuid();
  const item = {
    id,
    averageRating: 0,
    stock: 10,
    description: "",
    discountAmount: null,
    discountedPrice: null,
    ...data,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  await docClient.send(new PutCommand({ TableName: TABLE, Item: item }));
  return decorate(item);
};

Product.findByIdAndUpdate = async function (id, update = {}, opts = {}) {
  if (!id) return null;
  const sets = [];
  const removes = [];
  const eav = {};
  const ean = {};
  let i = 0;
  for (const [k, v] of Object.entries(update)) {
    const nameKey = `#k${i}`;
    ean[nameKey] = k;
    if (v === null || v === undefined) {
      removes.push(nameKey);
    } else {
      const valKey = `:v${i}`;
      sets.push(`${nameKey} = ${valKey}`);
      eav[valKey] = v;
    }
    i++;
  }
  const updNameKey = `#k${i}`;
  ean[updNameKey] = "updatedAt";
  sets.push(`${updNameKey} = :nowv`);
  eav[":nowv"] = nowIso();
  const parts = [];
  if (sets.length) parts.push("SET " + sets.join(", "));
  if (removes.length) parts.push("REMOVE " + removes.join(", "));
  await docClient.send(new UpdateCommand({
    TableName: TABLE,
    Key: { id: String(id) },
    UpdateExpression: parts.join(" "),
    ExpressionAttributeNames: ean,
    ...(Object.keys(eav).length && { ExpressionAttributeValues: eav }),
  }));
  return await Product.findById(id);
};

Product.findByIdAndDelete = async function (id) {
  if (!id) return null;
  const existing = await Product.findById(id);
  if (!existing) return null;
  await docClient.send(new DeleteCommand({ TableName: TABLE, Key: { id: String(id) } }));
  return existing;
};

Product.distinct = async function (field, filter) {
  const items = await scanAll(filter);
  const seen = new Set();
  for (const it of items) {
    const v = it?.[field];
    if (v !== undefined && v !== null) seen.add(v);
  }
  return [...seen];
};

Product.exists = async function (filter) {
  if (filter.category !== undefined) {
    const out = await docClient.send(new QueryCommand({
      TableName: TABLE,
      IndexName: "category-index",
      KeyConditionExpression: "category = :c",
      ExpressionAttributeValues: { ":c": filter.category },
      Limit: 1,
    }));
    return out.Items?.length ? { _id: out.Items[0].id } : null;
  }
  const items = await scanAll(filter);
  return items.length ? { _id: items[0].id } : null;
};

// Helper for the "auto-increment product_id" case in productmanager.js.
Product.maxProductId = async function () {
  // Scan-based: small inventories, fine for a class project.
  const items = await scanAll({});
  let max = 0;
  for (const it of items) {
    if (typeof it.product_id === "number" && it.product_id > max) max = it.product_id;
  }
  return max;
};

registerPopulateResolver("productId", () => Product);

module.exports = Product;
