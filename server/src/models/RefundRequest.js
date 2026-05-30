const {
  docClient, tables,
  GetCommand, PutCommand, UpdateCommand, DeleteCommand, QueryCommand, ScanCommand,
} = require("../config");
const {
  uuid, nowIso, attachSave, Query, finalize,
} = require("./_base");

const TABLE = tables.refundRequests;

function decorate(item) {
  if (!item) return null;
  if (item.id && !item._id) item._id = item.id;
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

async function queryByUser(userId) {
  const out = await docClient.send(new QueryCommand({
    TableName: TABLE,
    IndexName: "userId-index",
    KeyConditionExpression: "userId = :u",
    ExpressionAttributeValues: { ":u": String(userId) },
  }));
  return out.Items || [];
}

async function queryByPurchase(purchaseId) {
  const out = await docClient.send(new QueryCommand({
    TableName: TABLE,
    IndexName: "purchaseId-index",
    KeyConditionExpression: "purchaseId = :p",
    ExpressionAttributeValues: { ":p": String(purchaseId) },
  }));
  return out.Items || [];
}

function RefundRequest(data) {
  if (!(this instanceof RefundRequest)) return new RefundRequest(data);
  Object.assign(this, data || {});
  if (!this.id) this.id = uuid();
  if (!this.status) this.status = "pending";
  if (!this.requestDate) this.requestDate = nowIso();
  this._id = this.id;
  return decorate(this);
}

RefundRequest.findById = async function (id) {
  if (!id) return null;
  const out = await docClient.send(new GetCommand({ TableName: TABLE, Key: { id: String(id) } }));
  return decorate(out.Item || null);
};

RefundRequest.findOne = async function (filter = {}) {
  if (filter.purchaseId) {
    const items = await queryByPurchase(filter.purchaseId);
    const match = items.find((it) => {
      for (const [k, v] of Object.entries(filter)) {
        if (it[k] !== v) return false;
      }
      return true;
    });
    return decorate(match || null);
  }
  const items = await scanAll();
  const match = items.find((it) => {
    for (const [k, v] of Object.entries(filter)) {
      if (it[k] !== v) return false;
    }
    return true;
  });
  return decorate(match || null);
};

RefundRequest.find = function (filter = {}) {
  return new Query(async (opts) => {
    let items;
    if (filter.userId) {
      items = await queryByUser(filter.userId);
    } else if (filter.purchaseId) {
      items = await queryByPurchase(filter.purchaseId);
    } else {
      items = await scanAll();
    }
    return await finalize(items.map(decorate), opts);
  });
};

module.exports = RefundRequest;
