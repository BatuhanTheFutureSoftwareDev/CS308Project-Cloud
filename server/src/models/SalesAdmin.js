const {
  docClient, tables,
  GetCommand, PutCommand, DeleteCommand,
} = require("../config");
const { nowIso, attachSave } = require("./_base");

const TABLE = tables.salesAdmins;

function decorate(item) {
  if (!item) return null;
  if (item.userId && !item._id) item._id = item.userId;
  return attachSave(item, TABLE, docClient, PutCommand);
}

const SalesAdmin = {
  async exists(filter) {
    if (!filter?.userId) return null;
    const out = await docClient.send(new GetCommand({ TableName: TABLE, Key: { userId: String(filter.userId) } }));
    return out.Item ? { _id: out.Item.userId } : null;
  },
  async create({ userId }) {
    if (!userId) throw new Error("SalesAdmin.create requires userId");
    const item = { userId: String(userId), createdAt: nowIso(), updatedAt: nowIso() };
    await docClient.send(new PutCommand({ TableName: TABLE, Item: item }));
    return decorate(item);
  },
  async findOne(filter) {
    if (!filter?.userId) return null;
    const out = await docClient.send(new GetCommand({ TableName: TABLE, Key: { userId: String(filter.userId) } }));
    return decorate(out.Item || null);
  },
  async delete(filter) {
    if (!filter?.userId) return null;
    await docClient.send(new DeleteCommand({ TableName: TABLE, Key: { userId: String(filter.userId) } }));
    return true;
  },
};

module.exports = SalesAdmin;
