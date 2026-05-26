const {
  docClient, tables,
  GetCommand, PutCommand, UpdateCommand, DeleteCommand, QueryCommand, ScanCommand,
} = require("../config");
const {
  uuid, nowIso, attachSave, project, Query, finalize, DuplicateKeyError,
  registerPopulateResolver,
} = require("./_base");

const TABLE = tables.users;

function decorate(item) {
  if (!item) return null;
  if (item.id && !item._id) item._id = item.id;
  return attachSave(item, TABLE, docClient, PutCommand);
}

function User(data) {
  if (!(this instanceof User)) return new User(data);
  Object.assign(this, data || {});
  if (!this.id) this.id = uuid();
  this._id = this.id;
  return decorate(this);
}

User.findById = async function (id) {
  if (!id) return null;
  const out = await docClient.send(new GetCommand({ TableName: TABLE, Key: { id: String(id) } }));
  return decorate(out.Item || null);
};

User.findOne = async function (filter = {}) {
  if (filter.mail_adress) {
    const out = await docClient.send(new QueryCommand({
      TableName: TABLE,
      IndexName: "mail_adress-index",
      KeyConditionExpression: "mail_adress = :m",
      ExpressionAttributeValues: { ":m": filter.mail_adress },
      Limit: 1,
    }));
    const item = decorate(out.Items?.[0] || null);
    if (!item) return null;
    if (filter.resetPasswordToken !== undefined && item.resetPasswordToken !== filter.resetPasswordToken) return null;
    if (filter._id && String(item._id) !== String(filter._id)) return null;
    return item;
  }
  if (filter._id || filter.id) {
    const id = String(filter._id || filter.id);
    const item = await User.findById(id);
    if (!item) return null;
    for (const [k, v] of Object.entries(filter)) {
      if (k === "_id" || k === "id") continue;
      if (item[k] !== v) return null;
    }
    return item;
  }
  const out = await docClient.send(new ScanCommand({ TableName: TABLE }));
  for (const it of out.Items || []) {
    let ok = true;
    for (const [k, v] of Object.entries(filter)) {
      if (it[k] !== v) { ok = false; break; }
    }
    if (ok) return decorate(it);
  }
  return null;
};

User.create = async function (data) {
  const id = data.id || uuid();
  const item = {
    id,
    ...data,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  await docClient.send(new PutCommand({ TableName: TABLE, Item: item }));
  return decorate(item);
};

User.findByIdAndUpdate = async function (id, update = {}, opts = {}) {
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
  if (opts?.select) {
    const fresh = await User.findById(id);
    return project(fresh, opts.select);
  }
  return await User.findById(id);
};

User.exists = async function (filter) {
  const found = await User.findOne(filter);
  return found ? { _id: found._id } : null;
};

registerPopulateResolver("userId", () => User);

module.exports = User;
