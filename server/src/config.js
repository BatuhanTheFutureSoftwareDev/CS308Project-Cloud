require("dotenv").config();

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  QueryCommand,
  ScanCommand,
  BatchGetCommand,
  BatchWriteCommand,
} = require("@aws-sdk/lib-dynamodb");

const region = process.env.AWS_REGION || "eu-west-1";

const rawClient = new DynamoDBClient({ region });
const docClient = DynamoDBDocumentClient.from(rawClient, {
  marshallOptions: {
    removeUndefinedValues: true,
    convertEmptyValues: false,
  },
});

const tables = {
  users:          process.env.TABLE_USERS           || "cs436-db-users",
  products:       process.env.TABLE_PRODUCTS        || "cs436-db-products",
  categories:     process.env.TABLE_CATEGORIES     || "cs436-db-categories",
  carts:          process.env.TABLE_CARTS          || "cs436-db-carts",
  wishlists:      process.env.TABLE_WISHLISTS     || "cs436-db-wishlists",
  reviews:        process.env.TABLE_REVIEWS       || "cs436-db-reviews",
  purchases:      process.env.TABLE_PURCHASES     || "cs436-db-purchases",
  refundRequests: process.env.TABLE_REFUND_REQUESTS|| "cs436-db-refund-requests",
  admins:         process.env.TABLE_ADMINS        || "cs436-db-admins",
  salesAdmins:    process.env.TABLE_SALES_ADMINS  || "cs436-db-sales-admins",
};

async function ping() {
  try {
    await docClient.send(new ScanCommand({ TableName: tables.users, Limit: 1 }));
    console.log(`DynamoDB reachable in ${region}`);
  } catch (err) {
    console.error(`DynamoDB unreachable in ${region}: ${err.message}`);
  }
}

module.exports = {
  docClient,
  tables,
  region,
  ping,
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  QueryCommand,
  ScanCommand,
  BatchGetCommand,
  BatchWriteCommand,
};
