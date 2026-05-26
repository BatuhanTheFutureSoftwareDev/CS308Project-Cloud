const { randomUUID } = require("crypto");

const COMPOSITE_SEP = "__";

function nowIso() { return new Date().toISOString(); }
function uuid() { return randomUUID(); }

function compositeId(userId, productId) {
  return `${userId}${COMPOSITE_SEP}${productId}`;
}

function parseCompositeId(id) {
  const idx = id.indexOf(COMPOSITE_SEP);
  if (idx === -1) return null;
  return { userId: id.slice(0, idx), productId: id.slice(idx + COMPOSITE_SEP.length) };
}

function project(item, fields) {
  if (!item || !fields) return item;
  const keep = fields.split(/\s+/).filter(Boolean);
  if (!keep.length) return item;
  const out = {};
  for (const k of keep) if (item[k] !== undefined) out[k] = item[k];
  if (item._id !== undefined && !out._id) out._id = item._id;
  return out;
}

function attachSave(item, table, docClient, PutCommand) {
  if (!item) return item;
  Object.defineProperty(item, "save", {
    enumerable: false,
    writable: true,
    value: async function () {
      const out = {};
      for (const k of Object.keys(this)) {
        if (k === "save" || k === "toObject") continue;
        out[k] = this[k];
      }
      out.updatedAt = nowIso();
      if (!out.createdAt) out.createdAt = nowIso();
      await docClient.send(new PutCommand({ TableName: table, Item: out }));
      Object.assign(this, out);
      return this;
    },
  });
  Object.defineProperty(item, "toObject", {
    enumerable: false,
    writable: true,
    value: function () {
      const out = {};
      for (const k of Object.keys(this)) {
        if (k === "save" || k === "toObject") continue;
        out[k] = this[k];
      }
      return out;
    },
  });
  return item;
}

const POPULATE_RESOLVERS = {};
function registerPopulateResolver(field, fn) { POPULATE_RESOLVERS[field] = fn; }
function resolvePopulateModel(field) {
  const fn = POPULATE_RESOLVERS[field];
  return fn ? fn() : null;
}

class Query {
  constructor(executor) {
    this._executor = executor;
    this._populate = [];
    this._sort = null;
    this._select = null;
    this._limit = null;
  }
  populate(fields, projection) {
    const list = typeof fields === "string" ? fields.split(/\s+/).filter(Boolean) : [fields];
    for (const f of list) this._populate.push({ field: f, projection: projection || null });
    return this;
  }
  sort(spec) { this._sort = spec; return this; }
  select(s) { this._select = s; return this; }
  limit(n) { this._limit = n; return this; }
  then(onResolve, onReject) {
    const opts = {
      populate: this._populate,
      sort: this._sort,
      select: this._select,
      limit: this._limit,
    };
    return this._executor(opts).then(onResolve, onReject);
  }
  catch(onReject) { return this.then(undefined, onReject); }
  finally(onFinally) { return this.then().finally(onFinally); }
}

async function applyPopulate(items, populates) {
  if (!populates || !populates.length || !items || !items.length) return items;
  for (const { field, projection } of populates) {
    const Model = resolvePopulateModel(field);
    if (!Model) continue;
    const ids = [...new Set(items.map((it) => it && it[field]).filter(Boolean))];
    const fetched = await Promise.all(ids.map((id) => Model.findById(id).catch(() => null)));
    const byId = new Map();
    for (const f of fetched) if (f && f._id) byId.set(String(f._id), f);
    for (const it of items) {
      if (!it) continue;
      const raw = it[field];
      if (raw === undefined || raw === null) continue;
      const full = byId.get(String(raw));
      if (full) it[field] = projection ? project(full, projection) : full;
    }
  }
  return items;
}

function applySort(items, spec) {
  if (!spec || !items) return items;
  const entries = Object.entries(spec);
  return [...items].sort((a, b) => {
    for (const [key, dir] of entries) {
      const av = a?.[key];
      const bv = b?.[key];
      if (av === bv) continue;
      if (av === undefined || av === null) return 1;
      if (bv === undefined || bv === null) return -1;
      if (av < bv) return dir > 0 ? -1 : 1;
      if (av > bv) return dir > 0 ? 1 : -1;
    }
    return 0;
  });
}

function applySelect(items, fields) {
  if (!fields || !items) return items;
  return items.map((it) => project(it, fields));
}

async function finalize(items, opts) {
  let out = items;
  if (opts?.populate?.length) out = await applyPopulate(out, opts.populate);
  if (opts?.sort) out = applySort(out, opts.sort);
  if (opts?.select) out = applySelect(out, opts.select);
  if (opts?.limit) out = out.slice(0, opts.limit);
  return out;
}

class DuplicateKeyError extends Error {
  constructor(msg) { super(msg); this.code = 11000; this.name = "DuplicateKeyError"; }
}

module.exports = {
  nowIso,
  uuid,
  compositeId,
  parseCompositeId,
  project,
  attachSave,
  Query,
  finalize,
  applyPopulate,
  applySort,
  applySelect,
  registerPopulateResolver,
  resolvePopulateModel,
  DuplicateKeyError,
};
