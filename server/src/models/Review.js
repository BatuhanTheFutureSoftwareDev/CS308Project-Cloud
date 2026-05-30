const {
  docClient, tables,
  PutCommand, UpdateCommand, DeleteCommand, QueryCommand, ScanCommand,
} = require("../config");
const {
  nowIso, attachSave, compositeId, parseCompositeId, Query, finalize,
} = require("./_base");

const TABLE = tables.reviews;

function decorate(item) {
  if (!item) return null;
  if (!item._id && item.userId && item.productId) item._id = compositeId(item.userId, item.productId);
  return attachSave(item, TABLE, docClient, PutCommand);
}

async function queryByProduct(productId) {
  const out = await docClient.send(new QueryCommand({
    TableName: TABLE,
    IndexName: "productId-index",
    KeyConditionExpression: "productId = :p",
    ExpressionAttributeValues: { ":p": String(productId) },
  }));
  return out.Items || [];
}

async function queryByUser(userId) {
  const out = await docClient.send(new QueryCommand({
    TableName: TABLE,
    KeyConditionExpression: "userId = :u",
    ExpressionAttributeValues: { ":u": String(userId) },
  }));
  return out.Items || [];
}

function Review(data) {
  if (!(this instanceof Review)) return new Review(data);
  Object.assign(this, data || {});
  if (!this.status) this.status = "pending";
  if (this.comment === undefined) this.comment = "";
  this._id = compositeId(this.userId, this.productId);
  return decorate(this);
}

Review.find = function (filter = {}) {
  return new Query(async (opts) => {
    let items;
    if (filter.productId) {
      items = await queryByProduct(filter.productId);
    } else if (filter.userId) {
      items = await queryByUser(filter.userId);
    } else {
      const out = await docClient.send(new ScanCommand({ TableName: TABLE }));
      items = out.Items || [];
    }
    if (filter.userId && filter.productId) {
      items = items.filter((it) => it.userId === filter.userId && it.productId === filter.productId);
    }
    return await finalize(items.map(decorate), opts);
  });
};

Review.findOne = async function (filter = {}) {
  if (filter.userId && filter.productId) {
    const items = await queryByUser(filter.userId);
    const match = items.find((it) => it.productId === String(filter.productId));
    return decorate(match || null);
  }
  throw new Error("Review.findOne requires userId and productId");
};

Review.findByIdAndUpdate = async function (id, update = {}, opts = {}) {
  const parsed = parseCompositeId(String(id));
  if (!parsed) return null;
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
    Key: { userId: parsed.userId, productId: parsed.productId },
    UpdateExpression: parts.join(" "),
    ExpressionAttributeNames: ean,
    ...(Object.keys(eav).length && { ExpressionAttributeValues: eav }),
  }));
  const out = await docClient.send(new QueryCommand({
    TableName: TABLE,
    KeyConditionExpression: "userId = :u AND productId = :p",
    ExpressionAttributeValues: { ":u": parsed.userId, ":p": parsed.productId },
    Limit: 1,
  }));
  return decorate(out.Items?.[0] || null);
};

module.exports = Review;
