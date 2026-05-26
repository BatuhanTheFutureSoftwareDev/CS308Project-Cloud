const {
  docClient, tables,
  GetCommand, PutCommand, DeleteCommand, ScanCommand,
} = require("../config");
const {
  nowIso, attachSave, Query, finalize, DuplicateKeyError,
} = require("./_base");

const TABLE = tables.categories;

function decorate(item) {
  if (!item) return null;
  if (item.name && !item._id) item._id = item.name;
  return attachSave(item, TABLE, docClient, PutCommand);
}

async function scanAll() {
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
  return items;
}

function Category(data) {
  if (!(this instanceof Category)) return new Category(data);
  Object.assign(this, data || {});
  this._id = this.name;
  return decorate(this);
}

Category.find = function (filter = {}) {
  const q = new Query(async (opts) => {
    let items = await scanAll();
    items = items.map(decorate);
    if (filter && Object.keys(filter).length) {
      items = items.filter((it) => {
        for (const [k, v] of Object.entries(filter)) if (it[k] !== v) return false;
        return true;
      });
    }
    return await finalize(items, opts);
  });
  const origSort = q.sort.bind(q);
  q.sort = function (spec) {
    if (typeof spec === "string") {
      const dir = spec.startsWith("-") ? -1 : 1;
      const key = spec.replace(/^-/, "");
      return origSort({ [key]: dir });
    }
    return origSort(spec);
  };
  return q;
};

Category.create = async function (data) {
  if (!data?.name) throw new Error("Category requires a name");
  const name = String(data.name).trim();
  const item = { name, createdAt: nowIso(), updatedAt: nowIso() };
  try {
    await docClient.send(new PutCommand({
      TableName: TABLE,
      Item: item,
      ConditionExpression: "attribute_not_exists(#n)",
      ExpressionAttributeNames: { "#n": "name" },
    }));
  } catch (err) {
    if (err.name === "ConditionalCheckFailedException") {
      throw new DuplicateKeyError(`Category "${name}" already exists`);
    }
    throw err;
  }
  return decorate(item);
};

Category.exists = async function (filter) {
  if (!filter?.name) return null;
  const out = await docClient.send(new GetCommand({ TableName: TABLE, Key: { name: filter.name } }));
  return out.Item ? { _id: out.Item.name } : null;
};

Category.deleteOne = async function (filter) {
  if (!filter?.name) return { deletedCount: 0 };
  const exists = await Category.exists({ name: filter.name });
  if (!exists) return { deletedCount: 0 };
  await docClient.send(new DeleteCommand({ TableName: TABLE, Key: { name: filter.name } }));
  return { deletedCount: 1 };
};

module.exports = Category;
