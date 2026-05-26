const {
  docClient, tables,
  PutCommand, DeleteCommand, QueryCommand,
} = require("../config");
const {
  nowIso, attachSave, compositeId, Query, finalize,
} = require("./_base");

const TABLE = tables.wishlists;

function decorate(item) {
  if (!item) return null;
  if (!item._id && item.userId && item.productId) item._id = compositeId(item.userId, item.productId);
  return attachSave(item, TABLE, docClient, PutCommand);
}

async function queryByUser(userId) {
  const out = await docClient.send(new QueryCommand({
    TableName: TABLE,
    KeyConditionExpression: "userId = :u",
    ExpressionAttributeValues: { ":u": String(userId) },
  }));
  return out.Items || [];
}

function Wishlist(data) {
  if (!(this instanceof Wishlist)) return new Wishlist(data);
  Object.assign(this, data || {});
  this._id = compositeId(this.userId, this.productId);
  return decorate(this);
}

Wishlist.find = function (filter = {}) {
  return new Query(async (opts) => {
    if (!filter.userId) throw new Error("Wishlist.find requires userId");
    const items = (await queryByUser(filter.userId)).map(decorate);
    return await finalize(items, opts);
  });
};

Wishlist.findOne = async function (filter = {}) {
  if (filter.userId && filter.productId) {
    const items = await queryByUser(filter.userId);
    const match = items.find((it) => it.productId === String(filter.productId));
    return decorate(match || null);
  }
  throw new Error("Wishlist.findOne requires userId and productId");
};

Wishlist.findOneAndDelete = async function (filter = {}) {
  if (!filter.userId || !filter.productId) throw new Error("Wishlist.findOneAndDelete requires userId and productId");
  const existing = await Wishlist.findOne(filter);
  if (!existing) return null;
  await docClient.send(new DeleteCommand({
    TableName: TABLE,
    Key: { userId: String(filter.userId), productId: String(filter.productId) },
  }));
  return existing;
};

module.exports = Wishlist;
