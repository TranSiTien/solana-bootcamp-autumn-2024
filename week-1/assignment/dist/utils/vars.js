"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.connection = exports.CLUSTER_URL = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const web3_js_1 = require("@solana/web3.js");
// load the env variables from file
dotenv_1.default.config();
// load the env variables and store the cluster RPC url
exports.CLUSTER_URL = process.env.RPC_URL ?? (0, web3_js_1.clusterApiUrl)('devnet');
// create a new rpc connection
exports.connection = new web3_js_1.Connection(exports.CLUSTER_URL, "single");
