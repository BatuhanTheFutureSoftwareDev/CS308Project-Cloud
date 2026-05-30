const {
  docClient, tables,
  PutCommand, DeleteCommand, QueryCommand,
} = require("../config");
const {
  nowIso, attachSave, compositeId, Query, finalize,
} = require("./_base");

const TABLE = tables.carts;

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

function Cart(data) {
  if (!(this instanceof Cart)) return new Cart(data);
  Object.assign(this, data || {});
  if (!this.quantity) this.quantity = 1;
  this._id = compositeId(this.userId, this.productId);
  return decorate(this);
}

Cart.find = function (filter = {}) {
  return new Query(async (opts) => {
    if (!filter.userId) throw new Error("Cart.find requires userId");
    const items = (await queryByUser(filter.userId)).map(decorate);
    return await finalize(items, opts);
  });
};

Cart.findOne = async function (filter = {}) {
  if (filter.userId && filter.productId) {
    const items = await queryByUser(filter.userId);
    const match = items.find((it) => it.productId === String(filter.productId));
    return decorate(match || null);
  }
  if (filter.userId) {
    const items = await queryByUser(filter.userId);
    return decorate(items[0] || null);
  }
  throw new Error("Cart.findOne requires at least userId");
};

Cart.findOneAndDelete = async function (filter = {}) {
  if (!filter.userId || !filter.productId) throw new Error("Cart.findOneAndDelete requires userId and productId");
  const existing = await Cart.findOne(filter);
  if (!existing) return null;
  await docClient.send(new DeleteCommand({
    TableName: TABLE,
    Key: { userId: String(filter.userId), productId: String(filter.productId) },
  }));
  return existing;
};

Cart.deleteMany = async function (filter = {}) {
  if (!filter.userId) throw new Error("Cart.deleteMany requires userId");
  const items = await queryByUser(filter.userId);
  await Promise.all(items.map((it) =>
    docClient.send(new DeleteCommand({
      TableName: TABLE,
      Key: { userId: it.userId, productId: it.productId },
    }))
  ));
  return { deletedCount: items.length };
};

module.exports = Cart;
