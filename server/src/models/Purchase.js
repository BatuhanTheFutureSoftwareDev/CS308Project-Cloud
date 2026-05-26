const {
  docClient, tables,
  GetCommand, PutCommand, UpdateCommand, DeleteCommand, QueryCommand, ScanCommand,
} = require("../config");
const {
  uuid, nowIso, attachSave, Query, finalize,
  registerPopulateResolver,
} = require("./_base");

const TABLE = tables.purchases;

function decorate(item) {
  if (!item) return null;
  if (item.id && !item._id) item._id = item.id;
  return attachSave(item, TABLE, docClient, PutCommand);
}

async function scanAll(filter) {
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
  if (!filter || !Object.keys(filter).length) return items;
  return items.filter((it) => {
    for (const [k, v] of Object.entries(filter)) {
      if (v && typeof v === "object") {
        if ("$gte" in v && !(new Date(it[k]) >= new Date(v.$gte))) return false;
        if ("$lte" in v && !(new Date(it[k]) <= new Date(v.$lte))) return false;
      } else if (it[k] !== v) return false;
    }
    return true;
  });
}

async function queryByUser(userId) {
  const out = await docClient.send(new QueryCommand({
    TableName: TABLE,
    IndexName: "userId-index",
    KeyConditionExpression: "userId = :u",
    ExpressionAttributeValues: { ":u": String(userId) },
  }));
  return out.Items || [];
}

async function queryByOrder(orderId) {
  const out = await docClient.send(new QueryCommand({
    TableName: TABLE,
    IndexName: "orderId-index",
    KeyConditionExpression: "orderId = :o",
    ExpressionAttributeValues: { ":o": String(orderId) },
  }));
  return out.Items || [];
}

function Purchase(data) {
  if (!(this instanceof Purchase)) return new Purchase(data);
  Object.assign(this, data || {});
  if (!this.id) this.id = uuid();
  if (!this.status) this.status = "processing";
  if (!this.refundStatus) this.refundStatus = "none";
  if (!this.purchaseDate) this.purchaseDate = nowIso();
  if (!this.quantity) this.quantity = 1;
  this._id = this.id;
  return decorate(this);
}

Purchase.findById = async function (id) {
  if (!id) return null;
  const out = await docClient.send(new GetCommand({ TableName: TABLE, Key: { id: String(id) } }));
  return decorate(out.Item || null);
};

Purchase.find = function (filter = {}) {
  return new Query(async (opts) => {
    let items;
    if (filter.userId && filter.orderId) {
      items = await queryByUser(filter.userId);
      items = items.filter((it) => it.orderId === filter.orderId);
    } else if (filter.userId) {
      items = await queryByUser(filter.userId);
    } else if (filter.orderId) {
      items = await queryByOrder(filter.orderId);
    } else {
      items = await scanAll(filter);
    }
    return await finalize(items.map(decorate), opts);
  });
};

Purchase.findByIdAndUpdate = async function (id, update = {}, opts = {}) {
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
  return await Purchase.findById(id);
};

Purchase.findByIdAndDelete = async function (id) {
  if (!id) return null;
  const existing = await Purchase.findById(id);
  if (!existing) return null;
  await docClient.send(new DeleteCommand({ TableName: TABLE, Key: { id: String(id) } }));
  return existing;
};

registerPopulateResolver("purchaseId", () => Purchase);

module.exports = Purchase;
