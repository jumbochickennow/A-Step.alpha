var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// worker/http.ts
var HttpError = class extends Error {
  constructor(status, code) {
    super(code);
    this.status = status;
    this.code = code;
  }
  status;
  code;
  static {
    __name(this, "HttpError");
  }
};
var API_HEADERS = {
  "Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8",
  "X-Content-Type-Options": "nosniff"
};
function json(data, status = 200, extraHeaders) {
  const headers = new Headers(API_HEADERS);
  if (extraHeaders) new Headers(extraHeaders).forEach((value, key) => headers.append(key, value));
  return new Response(JSON.stringify(data), { status, headers });
}
__name(json, "json");
function publicErrorMessage(status) {
  if (status === 400) return "Bad request";
  if (status === 401) return "Unauthorized";
  if (status === 403) return "Forbidden";
  if (status === 404) return "Not found";
  if (status === 405) return "Method not allowed";
  if (status === 413) return "Payload too large";
  if (status === 415) return "Unsupported media type";
  if (status === 429) return "Too many requests";
  if (status === 503) return "Service unavailable";
  return "Internal server error";
}
__name(publicErrorMessage, "publicErrorMessage");
function errorResponse(error, requestId) {
  const status = error instanceof HttpError ? error.status : 500;
  if (!(error instanceof HttpError)) {
    console.error("Unhandled API error", { requestId, type: error instanceof Error ? error.name : "unknown" });
  }
  return json({ error: publicErrorMessage(status), requestId }, status);
}
__name(errorResponse, "errorResponse");
function attachRequestId(response, requestId) {
  const identified = new Response(response.body, response);
  identified.headers.set("X-Request-ID", requestId);
  return identified;
}
__name(attachRequestId, "attachRequestId");
async function readJson(request, maxBytes) {
  const contentType = request.headers.get("Content-Type")?.split(";", 1)[0].trim().toLowerCase();
  if (contentType !== "application/json") throw new HttpError(415, "unsupported_media_type");
  const declared = Number(request.headers.get("Content-Length") ?? "0");
  if (Number.isFinite(declared) && declared > maxBytes) throw new HttpError(413, "payload_too_large");
  const bytes = await request.arrayBuffer();
  if (bytes.byteLength > maxBytes) throw new HttpError(413, "payload_too_large");
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new HttpError(400, "invalid_json");
  }
}
__name(readJson, "readJson");
function requireMethod(request, allowed) {
  if (!allowed.includes(request.method)) throw new HttpError(405, "method_not_allowed");
}
__name(requireMethod, "requireMethod");
function requireIdempotencyKey(request) {
  const key = request.headers.get("Idempotency-Key")?.trim();
  if (!key || key.length > 128 || !/^[A-Za-z0-9._:-]+$/.test(key)) {
    throw new HttpError(400, "invalid_idempotency_key");
  }
  return key;
}
__name(requireIdempotencyKey, "requireIdempotencyKey");

// worker/auth/auth-api.ts
async function authenticateAccessAdmin(env, claims) {
  const id = claims.sub?.trim() ?? "";
  const email2 = claims.email?.trim().toLowerCase() ?? "";
  if (id.length < 1 || id.length > 255 || email2.length < 3 || email2.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email2)) throw new HttpError(401, "unauthorized");
  const now = (/* @__PURE__ */ new Date()).toISOString();
  try {
    await env.DB.prepare(
      `INSERT INTO admin_users (id, email, role, created_at, last_authenticated_at)
       VALUES (?1, ?2, 'admin', ?3, ?3)
       ON CONFLICT(id) DO UPDATE SET
         email = excluded.email,
         last_authenticated_at = excluded.last_authenticated_at`
    ).bind(id, email2, now).run();
    const admin = await env.DB.prepare(
      "SELECT id, email, role FROM admin_users WHERE id = ?1 LIMIT 1"
    ).bind(id).first();
    if (!admin) throw new Error("admin_audit_missing");
    return admin;
  } catch {
    throw new HttpError(503, "authentication_store_unavailable");
  }
}
__name(authenticateAccessAdmin, "authenticateAccessAdmin");
function signIn(request, identity) {
  requireMethod(request, ["POST"]);
  return json({ success: true, email: identity.email, role: identity.role });
}
__name(signIn, "signIn");
function sessionStatus(request, identity) {
  requireMethod(request, ["GET"]);
  return json({ success: true, email: identity.email, role: identity.role });
}
__name(sessionStatus, "sessionStatus");
function signOut(request) {
  requireMethod(request, ["POST"]);
  return json({ success: true, logoutUrl: "/cdn-cgi/access/logout" });
}
__name(signOut, "signOut");

// node_modules/zod/v3/external.js
var external_exports = {};
__export(external_exports, {
  BRAND: () => BRAND,
  DIRTY: () => DIRTY,
  EMPTY_PATH: () => EMPTY_PATH,
  INVALID: () => INVALID,
  NEVER: () => NEVER,
  OK: () => OK,
  ParseStatus: () => ParseStatus,
  Schema: () => ZodType,
  ZodAny: () => ZodAny,
  ZodArray: () => ZodArray,
  ZodBigInt: () => ZodBigInt,
  ZodBoolean: () => ZodBoolean,
  ZodBranded: () => ZodBranded,
  ZodCatch: () => ZodCatch,
  ZodDate: () => ZodDate,
  ZodDefault: () => ZodDefault,
  ZodDiscriminatedUnion: () => ZodDiscriminatedUnion,
  ZodEffects: () => ZodEffects,
  ZodEnum: () => ZodEnum,
  ZodError: () => ZodError,
  ZodFirstPartyTypeKind: () => ZodFirstPartyTypeKind,
  ZodFunction: () => ZodFunction,
  ZodIntersection: () => ZodIntersection,
  ZodIssueCode: () => ZodIssueCode,
  ZodLazy: () => ZodLazy,
  ZodLiteral: () => ZodLiteral,
  ZodMap: () => ZodMap,
  ZodNaN: () => ZodNaN,
  ZodNativeEnum: () => ZodNativeEnum,
  ZodNever: () => ZodNever,
  ZodNull: () => ZodNull,
  ZodNullable: () => ZodNullable,
  ZodNumber: () => ZodNumber,
  ZodObject: () => ZodObject,
  ZodOptional: () => ZodOptional,
  ZodParsedType: () => ZodParsedType,
  ZodPipeline: () => ZodPipeline,
  ZodPromise: () => ZodPromise,
  ZodReadonly: () => ZodReadonly,
  ZodRecord: () => ZodRecord,
  ZodSchema: () => ZodType,
  ZodSet: () => ZodSet,
  ZodString: () => ZodString,
  ZodSymbol: () => ZodSymbol,
  ZodTransformer: () => ZodEffects,
  ZodTuple: () => ZodTuple,
  ZodType: () => ZodType,
  ZodUndefined: () => ZodUndefined,
  ZodUnion: () => ZodUnion,
  ZodUnknown: () => ZodUnknown,
  ZodVoid: () => ZodVoid,
  addIssueToContext: () => addIssueToContext,
  any: () => anyType,
  array: () => arrayType,
  bigint: () => bigIntType,
  boolean: () => booleanType,
  coerce: () => coerce,
  custom: () => custom,
  date: () => dateType,
  datetimeRegex: () => datetimeRegex,
  defaultErrorMap: () => en_default,
  discriminatedUnion: () => discriminatedUnionType,
  effect: () => effectsType,
  enum: () => enumType,
  function: () => functionType,
  getErrorMap: () => getErrorMap,
  getParsedType: () => getParsedType,
  instanceof: () => instanceOfType,
  intersection: () => intersectionType,
  isAborted: () => isAborted,
  isAsync: () => isAsync,
  isDirty: () => isDirty,
  isValid: () => isValid,
  late: () => late,
  lazy: () => lazyType,
  literal: () => literalType,
  makeIssue: () => makeIssue,
  map: () => mapType,
  nan: () => nanType,
  nativeEnum: () => nativeEnumType,
  never: () => neverType,
  null: () => nullType,
  nullable: () => nullableType,
  number: () => numberType,
  object: () => objectType,
  objectUtil: () => objectUtil,
  oboolean: () => oboolean,
  onumber: () => onumber,
  optional: () => optionalType,
  ostring: () => ostring,
  pipeline: () => pipelineType,
  preprocess: () => preprocessType,
  promise: () => promiseType,
  quotelessJson: () => quotelessJson,
  record: () => recordType,
  set: () => setType,
  setErrorMap: () => setErrorMap,
  strictObject: () => strictObjectType,
  string: () => stringType,
  symbol: () => symbolType,
  transformer: () => effectsType,
  tuple: () => tupleType,
  undefined: () => undefinedType,
  union: () => unionType,
  unknown: () => unknownType,
  util: () => util,
  void: () => voidType
});

// node_modules/zod/v3/helpers/util.js
var util;
(function(util2) {
  util2.assertEqual = (_) => {
  };
  function assertIs(_arg) {
  }
  __name(assertIs, "assertIs");
  util2.assertIs = assertIs;
  function assertNever(_x) {
    throw new Error();
  }
  __name(assertNever, "assertNever");
  util2.assertNever = assertNever;
  util2.arrayToEnum = (items) => {
    const obj = {};
    for (const item of items) {
      obj[item] = item;
    }
    return obj;
  };
  util2.getValidEnumValues = (obj) => {
    const validKeys = util2.objectKeys(obj).filter((k) => typeof obj[obj[k]] !== "number");
    const filtered = {};
    for (const k of validKeys) {
      filtered[k] = obj[k];
    }
    return util2.objectValues(filtered);
  };
  util2.objectValues = (obj) => {
    return util2.objectKeys(obj).map(function(e) {
      return obj[e];
    });
  };
  util2.objectKeys = typeof Object.keys === "function" ? (obj) => Object.keys(obj) : (object) => {
    const keys = [];
    for (const key in object) {
      if (Object.prototype.hasOwnProperty.call(object, key)) {
        keys.push(key);
      }
    }
    return keys;
  };
  util2.find = (arr, checker) => {
    for (const item of arr) {
      if (checker(item))
        return item;
    }
    return void 0;
  };
  util2.isInteger = typeof Number.isInteger === "function" ? (val) => Number.isInteger(val) : (val) => typeof val === "number" && Number.isFinite(val) && Math.floor(val) === val;
  function joinValues(array, separator = " | ") {
    return array.map((val) => typeof val === "string" ? `'${val}'` : val).join(separator);
  }
  __name(joinValues, "joinValues");
  util2.joinValues = joinValues;
  util2.jsonStringifyReplacer = (_, value) => {
    if (typeof value === "bigint") {
      return value.toString();
    }
    return value;
  };
})(util || (util = {}));
var objectUtil;
(function(objectUtil2) {
  objectUtil2.mergeShapes = (first, second) => {
    return {
      ...first,
      ...second
      // second overwrites first
    };
  };
})(objectUtil || (objectUtil = {}));
var ZodParsedType = util.arrayToEnum([
  "string",
  "nan",
  "number",
  "integer",
  "float",
  "boolean",
  "date",
  "bigint",
  "symbol",
  "function",
  "undefined",
  "null",
  "array",
  "object",
  "unknown",
  "promise",
  "void",
  "never",
  "map",
  "set"
]);
var getParsedType = /* @__PURE__ */ __name((data) => {
  const t = typeof data;
  switch (t) {
    case "undefined":
      return ZodParsedType.undefined;
    case "string":
      return ZodParsedType.string;
    case "number":
      return Number.isNaN(data) ? ZodParsedType.nan : ZodParsedType.number;
    case "boolean":
      return ZodParsedType.boolean;
    case "function":
      return ZodParsedType.function;
    case "bigint":
      return ZodParsedType.bigint;
    case "symbol":
      return ZodParsedType.symbol;
    case "object":
      if (Array.isArray(data)) {
        return ZodParsedType.array;
      }
      if (data === null) {
        return ZodParsedType.null;
      }
      if (data.then && typeof data.then === "function" && data.catch && typeof data.catch === "function") {
        return ZodParsedType.promise;
      }
      if (typeof Map !== "undefined" && data instanceof Map) {
        return ZodParsedType.map;
      }
      if (typeof Set !== "undefined" && data instanceof Set) {
        return ZodParsedType.set;
      }
      if (typeof Date !== "undefined" && data instanceof Date) {
        return ZodParsedType.date;
      }
      return ZodParsedType.object;
    default:
      return ZodParsedType.unknown;
  }
}, "getParsedType");

// node_modules/zod/v3/ZodError.js
var ZodIssueCode = util.arrayToEnum([
  "invalid_type",
  "invalid_literal",
  "custom",
  "invalid_union",
  "invalid_union_discriminator",
  "invalid_enum_value",
  "unrecognized_keys",
  "invalid_arguments",
  "invalid_return_type",
  "invalid_date",
  "invalid_string",
  "too_small",
  "too_big",
  "invalid_intersection_types",
  "not_multiple_of",
  "not_finite"
]);
var quotelessJson = /* @__PURE__ */ __name((obj) => {
  const json2 = JSON.stringify(obj, null, 2);
  return json2.replace(/"([^"]+)":/g, "$1:");
}, "quotelessJson");
var ZodError = class _ZodError extends Error {
  static {
    __name(this, "ZodError");
  }
  get errors() {
    return this.issues;
  }
  constructor(issues) {
    super();
    this.issues = [];
    this.addIssue = (sub) => {
      this.issues = [...this.issues, sub];
    };
    this.addIssues = (subs = []) => {
      this.issues = [...this.issues, ...subs];
    };
    const actualProto = new.target.prototype;
    if (Object.setPrototypeOf) {
      Object.setPrototypeOf(this, actualProto);
    } else {
      this.__proto__ = actualProto;
    }
    this.name = "ZodError";
    this.issues = issues;
  }
  format(_mapper) {
    const mapper = _mapper || function(issue) {
      return issue.message;
    };
    const fieldErrors = { _errors: [] };
    const processError = /* @__PURE__ */ __name((error) => {
      for (const issue of error.issues) {
        if (issue.code === "invalid_union") {
          issue.unionErrors.map(processError);
        } else if (issue.code === "invalid_return_type") {
          processError(issue.returnTypeError);
        } else if (issue.code === "invalid_arguments") {
          processError(issue.argumentsError);
        } else if (issue.path.length === 0) {
          fieldErrors._errors.push(mapper(issue));
        } else {
          let curr = fieldErrors;
          let i = 0;
          while (i < issue.path.length) {
            const el = issue.path[i];
            const terminal = i === issue.path.length - 1;
            if (!terminal) {
              curr[el] = curr[el] || { _errors: [] };
            } else {
              curr[el] = curr[el] || { _errors: [] };
              curr[el]._errors.push(mapper(issue));
            }
            curr = curr[el];
            i++;
          }
        }
      }
    }, "processError");
    processError(this);
    return fieldErrors;
  }
  static assert(value) {
    if (!(value instanceof _ZodError)) {
      throw new Error(`Not a ZodError: ${value}`);
    }
  }
  toString() {
    return this.message;
  }
  get message() {
    return JSON.stringify(this.issues, util.jsonStringifyReplacer, 2);
  }
  get isEmpty() {
    return this.issues.length === 0;
  }
  flatten(mapper = (issue) => issue.message) {
    const fieldErrors = {};
    const formErrors = [];
    for (const sub of this.issues) {
      if (sub.path.length > 0) {
        const firstEl = sub.path[0];
        fieldErrors[firstEl] = fieldErrors[firstEl] || [];
        fieldErrors[firstEl].push(mapper(sub));
      } else {
        formErrors.push(mapper(sub));
      }
    }
    return { formErrors, fieldErrors };
  }
  get formErrors() {
    return this.flatten();
  }
};
ZodError.create = (issues) => {
  const error = new ZodError(issues);
  return error;
};

// node_modules/zod/v3/locales/en.js
var errorMap = /* @__PURE__ */ __name((issue, _ctx) => {
  let message;
  switch (issue.code) {
    case ZodIssueCode.invalid_type:
      if (issue.received === ZodParsedType.undefined) {
        message = "Required";
      } else {
        message = `Expected ${issue.expected}, received ${issue.received}`;
      }
      break;
    case ZodIssueCode.invalid_literal:
      message = `Invalid literal value, expected ${JSON.stringify(issue.expected, util.jsonStringifyReplacer)}`;
      break;
    case ZodIssueCode.unrecognized_keys:
      message = `Unrecognized key(s) in object: ${util.joinValues(issue.keys, ", ")}`;
      break;
    case ZodIssueCode.invalid_union:
      message = `Invalid input`;
      break;
    case ZodIssueCode.invalid_union_discriminator:
      message = `Invalid discriminator value. Expected ${util.joinValues(issue.options)}`;
      break;
    case ZodIssueCode.invalid_enum_value:
      message = `Invalid enum value. Expected ${util.joinValues(issue.options)}, received '${issue.received}'`;
      break;
    case ZodIssueCode.invalid_arguments:
      message = `Invalid function arguments`;
      break;
    case ZodIssueCode.invalid_return_type:
      message = `Invalid function return type`;
      break;
    case ZodIssueCode.invalid_date:
      message = `Invalid date`;
      break;
    case ZodIssueCode.invalid_string:
      if (typeof issue.validation === "object") {
        if ("includes" in issue.validation) {
          message = `Invalid input: must include "${issue.validation.includes}"`;
          if (typeof issue.validation.position === "number") {
            message = `${message} at one or more positions greater than or equal to ${issue.validation.position}`;
          }
        } else if ("startsWith" in issue.validation) {
          message = `Invalid input: must start with "${issue.validation.startsWith}"`;
        } else if ("endsWith" in issue.validation) {
          message = `Invalid input: must end with "${issue.validation.endsWith}"`;
        } else {
          util.assertNever(issue.validation);
        }
      } else if (issue.validation !== "regex") {
        message = `Invalid ${issue.validation}`;
      } else {
        message = "Invalid";
      }
      break;
    case ZodIssueCode.too_small:
      if (issue.type === "array")
        message = `Array must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `more than`} ${issue.minimum} element(s)`;
      else if (issue.type === "string")
        message = `String must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `over`} ${issue.minimum} character(s)`;
      else if (issue.type === "number")
        message = `Number must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${issue.minimum}`;
      else if (issue.type === "bigint")
        message = `Number must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${issue.minimum}`;
      else if (issue.type === "date")
        message = `Date must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${new Date(Number(issue.minimum))}`;
      else
        message = "Invalid input";
      break;
    case ZodIssueCode.too_big:
      if (issue.type === "array")
        message = `Array must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `less than`} ${issue.maximum} element(s)`;
      else if (issue.type === "string")
        message = `String must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `under`} ${issue.maximum} character(s)`;
      else if (issue.type === "number")
        message = `Number must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`;
      else if (issue.type === "bigint")
        message = `BigInt must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`;
      else if (issue.type === "date")
        message = `Date must be ${issue.exact ? `exactly` : issue.inclusive ? `smaller than or equal to` : `smaller than`} ${new Date(Number(issue.maximum))}`;
      else
        message = "Invalid input";
      break;
    case ZodIssueCode.custom:
      message = `Invalid input`;
      break;
    case ZodIssueCode.invalid_intersection_types:
      message = `Intersection results could not be merged`;
      break;
    case ZodIssueCode.not_multiple_of:
      message = `Number must be a multiple of ${issue.multipleOf}`;
      break;
    case ZodIssueCode.not_finite:
      message = "Number must be finite";
      break;
    default:
      message = _ctx.defaultError;
      util.assertNever(issue);
  }
  return { message };
}, "errorMap");
var en_default = errorMap;

// node_modules/zod/v3/errors.js
var overrideErrorMap = en_default;
function setErrorMap(map) {
  overrideErrorMap = map;
}
__name(setErrorMap, "setErrorMap");
function getErrorMap() {
  return overrideErrorMap;
}
__name(getErrorMap, "getErrorMap");

// node_modules/zod/v3/helpers/parseUtil.js
var makeIssue = /* @__PURE__ */ __name((params) => {
  const { data, path, errorMaps, issueData } = params;
  const fullPath = [...path, ...issueData.path || []];
  const fullIssue = {
    ...issueData,
    path: fullPath
  };
  if (issueData.message !== void 0) {
    return {
      ...issueData,
      path: fullPath,
      message: issueData.message
    };
  }
  let errorMessage = "";
  const maps = errorMaps.filter((m) => !!m).slice().reverse();
  for (const map of maps) {
    errorMessage = map(fullIssue, { data, defaultError: errorMessage }).message;
  }
  return {
    ...issueData,
    path: fullPath,
    message: errorMessage
  };
}, "makeIssue");
var EMPTY_PATH = [];
function addIssueToContext(ctx, issueData) {
  const overrideMap = getErrorMap();
  const issue = makeIssue({
    issueData,
    data: ctx.data,
    path: ctx.path,
    errorMaps: [
      ctx.common.contextualErrorMap,
      // contextual error map is first priority
      ctx.schemaErrorMap,
      // then schema-bound map if available
      overrideMap,
      // then global override map
      overrideMap === en_default ? void 0 : en_default
      // then global default map
    ].filter((x) => !!x)
  });
  ctx.common.issues.push(issue);
}
__name(addIssueToContext, "addIssueToContext");
var ParseStatus = class _ParseStatus {
  static {
    __name(this, "ParseStatus");
  }
  constructor() {
    this.value = "valid";
  }
  dirty() {
    if (this.value === "valid")
      this.value = "dirty";
  }
  abort() {
    if (this.value !== "aborted")
      this.value = "aborted";
  }
  static mergeArray(status, results) {
    const arrayValue = [];
    for (const s of results) {
      if (s.status === "aborted")
        return INVALID;
      if (s.status === "dirty")
        status.dirty();
      arrayValue.push(s.value);
    }
    return { status: status.value, value: arrayValue };
  }
  static async mergeObjectAsync(status, pairs) {
    const syncPairs = [];
    for (const pair of pairs) {
      const key = await pair.key;
      const value = await pair.value;
      syncPairs.push({
        key,
        value
      });
    }
    return _ParseStatus.mergeObjectSync(status, syncPairs);
  }
  static mergeObjectSync(status, pairs) {
    const finalObject = {};
    for (const pair of pairs) {
      const { key, value } = pair;
      if (key.status === "aborted")
        return INVALID;
      if (value.status === "aborted")
        return INVALID;
      if (key.status === "dirty")
        status.dirty();
      if (value.status === "dirty")
        status.dirty();
      if (key.value !== "__proto__" && (typeof value.value !== "undefined" || pair.alwaysSet)) {
        finalObject[key.value] = value.value;
      }
    }
    return { status: status.value, value: finalObject };
  }
};
var INVALID = Object.freeze({
  status: "aborted"
});
var DIRTY = /* @__PURE__ */ __name((value) => ({ status: "dirty", value }), "DIRTY");
var OK = /* @__PURE__ */ __name((value) => ({ status: "valid", value }), "OK");
var isAborted = /* @__PURE__ */ __name((x) => x.status === "aborted", "isAborted");
var isDirty = /* @__PURE__ */ __name((x) => x.status === "dirty", "isDirty");
var isValid = /* @__PURE__ */ __name((x) => x.status === "valid", "isValid");
var isAsync = /* @__PURE__ */ __name((x) => typeof Promise !== "undefined" && x instanceof Promise, "isAsync");

// node_modules/zod/v3/helpers/errorUtil.js
var errorUtil;
(function(errorUtil2) {
  errorUtil2.errToObj = (message) => typeof message === "string" ? { message } : message || {};
  errorUtil2.toString = (message) => typeof message === "string" ? message : message?.message;
})(errorUtil || (errorUtil = {}));

// node_modules/zod/v3/types.js
var ParseInputLazyPath = class {
  static {
    __name(this, "ParseInputLazyPath");
  }
  constructor(parent, value, path, key) {
    this._cachedPath = [];
    this.parent = parent;
    this.data = value;
    this._path = path;
    this._key = key;
  }
  get path() {
    if (!this._cachedPath.length) {
      if (Array.isArray(this._key)) {
        this._cachedPath.push(...this._path, ...this._key);
      } else {
        this._cachedPath.push(...this._path, this._key);
      }
    }
    return this._cachedPath;
  }
};
var handleResult = /* @__PURE__ */ __name((ctx, result) => {
  if (isValid(result)) {
    return { success: true, data: result.value };
  } else {
    if (!ctx.common.issues.length) {
      throw new Error("Validation failed but no issues detected.");
    }
    return {
      success: false,
      get error() {
        if (this._error)
          return this._error;
        const error = new ZodError(ctx.common.issues);
        this._error = error;
        return this._error;
      }
    };
  }
}, "handleResult");
function processCreateParams(params) {
  if (!params)
    return {};
  const { errorMap: errorMap2, invalid_type_error, required_error, description } = params;
  if (errorMap2 && (invalid_type_error || required_error)) {
    throw new Error(`Can't use "invalid_type_error" or "required_error" in conjunction with custom error map.`);
  }
  if (errorMap2)
    return { errorMap: errorMap2, description };
  const customMap = /* @__PURE__ */ __name((iss, ctx) => {
    const { message } = params;
    if (iss.code === "invalid_enum_value") {
      return { message: message ?? ctx.defaultError };
    }
    if (typeof ctx.data === "undefined") {
      return { message: message ?? required_error ?? ctx.defaultError };
    }
    if (iss.code !== "invalid_type")
      return { message: ctx.defaultError };
    return { message: message ?? invalid_type_error ?? ctx.defaultError };
  }, "customMap");
  return { errorMap: customMap, description };
}
__name(processCreateParams, "processCreateParams");
var ZodType = class {
  static {
    __name(this, "ZodType");
  }
  get description() {
    return this._def.description;
  }
  _getType(input) {
    return getParsedType(input.data);
  }
  _getOrReturnCtx(input, ctx) {
    return ctx || {
      common: input.parent.common,
      data: input.data,
      parsedType: getParsedType(input.data),
      schemaErrorMap: this._def.errorMap,
      path: input.path,
      parent: input.parent
    };
  }
  _processInputParams(input) {
    return {
      status: new ParseStatus(),
      ctx: {
        common: input.parent.common,
        data: input.data,
        parsedType: getParsedType(input.data),
        schemaErrorMap: this._def.errorMap,
        path: input.path,
        parent: input.parent
      }
    };
  }
  _parseSync(input) {
    const result = this._parse(input);
    if (isAsync(result)) {
      throw new Error("Synchronous parse encountered promise.");
    }
    return result;
  }
  _parseAsync(input) {
    const result = this._parse(input);
    return Promise.resolve(result);
  }
  parse(data, params) {
    const result = this.safeParse(data, params);
    if (result.success)
      return result.data;
    throw result.error;
  }
  safeParse(data, params) {
    const ctx = {
      common: {
        issues: [],
        async: params?.async ?? false,
        contextualErrorMap: params?.errorMap
      },
      path: params?.path || [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data)
    };
    const result = this._parseSync({ data, path: ctx.path, parent: ctx });
    return handleResult(ctx, result);
  }
  "~validate"(data) {
    const ctx = {
      common: {
        issues: [],
        async: !!this["~standard"].async
      },
      path: [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data)
    };
    if (!this["~standard"].async) {
      try {
        const result = this._parseSync({ data, path: [], parent: ctx });
        return isValid(result) ? {
          value: result.value
        } : {
          issues: ctx.common.issues
        };
      } catch (err) {
        if (err?.message?.toLowerCase()?.includes("encountered")) {
          this["~standard"].async = true;
        }
        ctx.common = {
          issues: [],
          async: true
        };
      }
    }
    return this._parseAsync({ data, path: [], parent: ctx }).then((result) => isValid(result) ? {
      value: result.value
    } : {
      issues: ctx.common.issues
    });
  }
  async parseAsync(data, params) {
    const result = await this.safeParseAsync(data, params);
    if (result.success)
      return result.data;
    throw result.error;
  }
  async safeParseAsync(data, params) {
    const ctx = {
      common: {
        issues: [],
        contextualErrorMap: params?.errorMap,
        async: true
      },
      path: params?.path || [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data)
    };
    const maybeAsyncResult = this._parse({ data, path: ctx.path, parent: ctx });
    const result = await (isAsync(maybeAsyncResult) ? maybeAsyncResult : Promise.resolve(maybeAsyncResult));
    return handleResult(ctx, result);
  }
  refine(check, message) {
    const getIssueProperties = /* @__PURE__ */ __name((val) => {
      if (typeof message === "string" || typeof message === "undefined") {
        return { message };
      } else if (typeof message === "function") {
        return message(val);
      } else {
        return message;
      }
    }, "getIssueProperties");
    return this._refinement((val, ctx) => {
      const result = check(val);
      const setError = /* @__PURE__ */ __name(() => ctx.addIssue({
        code: ZodIssueCode.custom,
        ...getIssueProperties(val)
      }), "setError");
      if (typeof Promise !== "undefined" && result instanceof Promise) {
        return result.then((data) => {
          if (!data) {
            setError();
            return false;
          } else {
            return true;
          }
        });
      }
      if (!result) {
        setError();
        return false;
      } else {
        return true;
      }
    });
  }
  refinement(check, refinementData) {
    return this._refinement((val, ctx) => {
      if (!check(val)) {
        ctx.addIssue(typeof refinementData === "function" ? refinementData(val, ctx) : refinementData);
        return false;
      } else {
        return true;
      }
    });
  }
  _refinement(refinement) {
    return new ZodEffects({
      schema: this,
      typeName: ZodFirstPartyTypeKind.ZodEffects,
      effect: { type: "refinement", refinement }
    });
  }
  superRefine(refinement) {
    return this._refinement(refinement);
  }
  constructor(def) {
    this.spa = this.safeParseAsync;
    this._def = def;
    this.parse = this.parse.bind(this);
    this.safeParse = this.safeParse.bind(this);
    this.parseAsync = this.parseAsync.bind(this);
    this.safeParseAsync = this.safeParseAsync.bind(this);
    this.spa = this.spa.bind(this);
    this.refine = this.refine.bind(this);
    this.refinement = this.refinement.bind(this);
    this.superRefine = this.superRefine.bind(this);
    this.optional = this.optional.bind(this);
    this.nullable = this.nullable.bind(this);
    this.nullish = this.nullish.bind(this);
    this.array = this.array.bind(this);
    this.promise = this.promise.bind(this);
    this.or = this.or.bind(this);
    this.and = this.and.bind(this);
    this.transform = this.transform.bind(this);
    this.brand = this.brand.bind(this);
    this.default = this.default.bind(this);
    this.catch = this.catch.bind(this);
    this.describe = this.describe.bind(this);
    this.pipe = this.pipe.bind(this);
    this.readonly = this.readonly.bind(this);
    this.isNullable = this.isNullable.bind(this);
    this.isOptional = this.isOptional.bind(this);
    this["~standard"] = {
      version: 1,
      vendor: "zod",
      validate: /* @__PURE__ */ __name((data) => this["~validate"](data), "validate")
    };
  }
  optional() {
    return ZodOptional.create(this, this._def);
  }
  nullable() {
    return ZodNullable.create(this, this._def);
  }
  nullish() {
    return this.nullable().optional();
  }
  array() {
    return ZodArray.create(this);
  }
  promise() {
    return ZodPromise.create(this, this._def);
  }
  or(option) {
    return ZodUnion.create([this, option], this._def);
  }
  and(incoming) {
    return ZodIntersection.create(this, incoming, this._def);
  }
  transform(transform) {
    return new ZodEffects({
      ...processCreateParams(this._def),
      schema: this,
      typeName: ZodFirstPartyTypeKind.ZodEffects,
      effect: { type: "transform", transform }
    });
  }
  default(def) {
    const defaultValueFunc = typeof def === "function" ? def : () => def;
    return new ZodDefault({
      ...processCreateParams(this._def),
      innerType: this,
      defaultValue: defaultValueFunc,
      typeName: ZodFirstPartyTypeKind.ZodDefault
    });
  }
  brand() {
    return new ZodBranded({
      typeName: ZodFirstPartyTypeKind.ZodBranded,
      type: this,
      ...processCreateParams(this._def)
    });
  }
  catch(def) {
    const catchValueFunc = typeof def === "function" ? def : () => def;
    return new ZodCatch({
      ...processCreateParams(this._def),
      innerType: this,
      catchValue: catchValueFunc,
      typeName: ZodFirstPartyTypeKind.ZodCatch
    });
  }
  describe(description) {
    const This = this.constructor;
    return new This({
      ...this._def,
      description
    });
  }
  pipe(target) {
    return ZodPipeline.create(this, target);
  }
  readonly() {
    return ZodReadonly.create(this);
  }
  isOptional() {
    return this.safeParse(void 0).success;
  }
  isNullable() {
    return this.safeParse(null).success;
  }
};
var cuidRegex = /^c[^\s-]{8,}$/i;
var cuid2Regex = /^[0-9a-z]+$/;
var ulidRegex = /^[0-9A-HJKMNP-TV-Z]{26}$/i;
var uuidRegex = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/i;
var nanoidRegex = /^[a-z0-9_-]{21}$/i;
var jwtRegex = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/;
var durationRegex = /^[-+]?P(?!$)(?:(?:[-+]?\d+Y)|(?:[-+]?\d+[.,]\d+Y$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:(?:[-+]?\d+W)|(?:[-+]?\d+[.,]\d+W$))?(?:(?:[-+]?\d+D)|(?:[-+]?\d+[.,]\d+D$))?(?:T(?=[\d+-])(?:(?:[-+]?\d+H)|(?:[-+]?\d+[.,]\d+H$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:[-+]?\d+(?:[.,]\d+)?S)?)??$/;
var emailRegex = /^(?!\.)(?!.*\.\.)([A-Z0-9_'+\-\.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9\-]*\.)+[A-Z]{2,}$/i;
var _emojiRegex = `^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$`;
var emojiRegex;
var ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/;
var ipv4CidrRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/(3[0-2]|[12]?[0-9])$/;
var ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;
var ipv6CidrRegex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/;
var base64Regex = /^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/;
var base64urlRegex = /^([0-9a-zA-Z-_]{4})*(([0-9a-zA-Z-_]{2}(==)?)|([0-9a-zA-Z-_]{3}(=)?))?$/;
var dateRegexSource = `((\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-((0[13578]|1[02])-(0[1-9]|[12]\\d|3[01])|(0[469]|11)-(0[1-9]|[12]\\d|30)|(02)-(0[1-9]|1\\d|2[0-8])))`;
var dateRegex = new RegExp(`^${dateRegexSource}$`);
function timeRegexSource(args) {
  let secondsRegexSource = `[0-5]\\d`;
  if (args.precision) {
    secondsRegexSource = `${secondsRegexSource}\\.\\d{${args.precision}}`;
  } else if (args.precision == null) {
    secondsRegexSource = `${secondsRegexSource}(\\.\\d+)?`;
  }
  const secondsQuantifier = args.precision ? "+" : "?";
  return `([01]\\d|2[0-3]):[0-5]\\d(:${secondsRegexSource})${secondsQuantifier}`;
}
__name(timeRegexSource, "timeRegexSource");
function timeRegex(args) {
  return new RegExp(`^${timeRegexSource(args)}$`);
}
__name(timeRegex, "timeRegex");
function datetimeRegex(args) {
  let regex = `${dateRegexSource}T${timeRegexSource(args)}`;
  const opts = [];
  opts.push(args.local ? `Z?` : `Z`);
  if (args.offset)
    opts.push(`([+-]\\d{2}:?\\d{2})`);
  regex = `${regex}(${opts.join("|")})`;
  return new RegExp(`^${regex}$`);
}
__name(datetimeRegex, "datetimeRegex");
function isValidIP(ip, version) {
  if ((version === "v4" || !version) && ipv4Regex.test(ip)) {
    return true;
  }
  if ((version === "v6" || !version) && ipv6Regex.test(ip)) {
    return true;
  }
  return false;
}
__name(isValidIP, "isValidIP");
function isValidJWT(jwt, alg) {
  if (!jwtRegex.test(jwt))
    return false;
  try {
    const [header] = jwt.split(".");
    if (!header)
      return false;
    const base64 = header.replace(/-/g, "+").replace(/_/g, "/").padEnd(header.length + (4 - header.length % 4) % 4, "=");
    const decoded = JSON.parse(atob(base64));
    if (typeof decoded !== "object" || decoded === null)
      return false;
    if ("typ" in decoded && decoded?.typ !== "JWT")
      return false;
    if (!decoded.alg)
      return false;
    if (alg && decoded.alg !== alg)
      return false;
    return true;
  } catch {
    return false;
  }
}
__name(isValidJWT, "isValidJWT");
function isValidCidr(ip, version) {
  if ((version === "v4" || !version) && ipv4CidrRegex.test(ip)) {
    return true;
  }
  if ((version === "v6" || !version) && ipv6CidrRegex.test(ip)) {
    return true;
  }
  return false;
}
__name(isValidCidr, "isValidCidr");
var ZodString = class _ZodString extends ZodType {
  static {
    __name(this, "ZodString");
  }
  _parse(input) {
    if (this._def.coerce) {
      input.data = String(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.string) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.string,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    const status = new ParseStatus();
    let ctx = void 0;
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        if (input.data.length < check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            minimum: check.value,
            type: "string",
            inclusive: true,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        if (input.data.length > check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            maximum: check.value,
            type: "string",
            inclusive: true,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "length") {
        const tooBig = input.data.length > check.value;
        const tooSmall = input.data.length < check.value;
        if (tooBig || tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          if (tooBig) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_big,
              maximum: check.value,
              type: "string",
              inclusive: true,
              exact: true,
              message: check.message
            });
          } else if (tooSmall) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_small,
              minimum: check.value,
              type: "string",
              inclusive: true,
              exact: true,
              message: check.message
            });
          }
          status.dirty();
        }
      } else if (check.kind === "email") {
        if (!emailRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "email",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "emoji") {
        if (!emojiRegex) {
          emojiRegex = new RegExp(_emojiRegex, "u");
        }
        if (!emojiRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "emoji",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "uuid") {
        if (!uuidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "uuid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "nanoid") {
        if (!nanoidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "nanoid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "cuid") {
        if (!cuidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "cuid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "cuid2") {
        if (!cuid2Regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "cuid2",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "ulid") {
        if (!ulidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "ulid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "url") {
        try {
          new URL(input.data);
        } catch {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "url",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "regex") {
        check.regex.lastIndex = 0;
        const testResult = check.regex.test(input.data);
        if (!testResult) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "regex",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "trim") {
        input.data = input.data.trim();
      } else if (check.kind === "includes") {
        if (!input.data.includes(check.value, check.position)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { includes: check.value, position: check.position },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "toLowerCase") {
        input.data = input.data.toLowerCase();
      } else if (check.kind === "toUpperCase") {
        input.data = input.data.toUpperCase();
      } else if (check.kind === "startsWith") {
        if (!input.data.startsWith(check.value)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { startsWith: check.value },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "endsWith") {
        if (!input.data.endsWith(check.value)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { endsWith: check.value },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "datetime") {
        const regex = datetimeRegex(check);
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "datetime",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "date") {
        const regex = dateRegex;
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "date",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "time") {
        const regex = timeRegex(check);
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "time",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "duration") {
        if (!durationRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "duration",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "ip") {
        if (!isValidIP(input.data, check.version)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "ip",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "jwt") {
        if (!isValidJWT(input.data, check.alg)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "jwt",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "cidr") {
        if (!isValidCidr(input.data, check.version)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "cidr",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "base64") {
        if (!base64Regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "base64",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "base64url") {
        if (!base64urlRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "base64url",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  _regex(regex, validation, message) {
    return this.refinement((data) => regex.test(data), {
      validation,
      code: ZodIssueCode.invalid_string,
      ...errorUtil.errToObj(message)
    });
  }
  _addCheck(check) {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  email(message) {
    return this._addCheck({ kind: "email", ...errorUtil.errToObj(message) });
  }
  url(message) {
    return this._addCheck({ kind: "url", ...errorUtil.errToObj(message) });
  }
  emoji(message) {
    return this._addCheck({ kind: "emoji", ...errorUtil.errToObj(message) });
  }
  uuid(message) {
    return this._addCheck({ kind: "uuid", ...errorUtil.errToObj(message) });
  }
  nanoid(message) {
    return this._addCheck({ kind: "nanoid", ...errorUtil.errToObj(message) });
  }
  cuid(message) {
    return this._addCheck({ kind: "cuid", ...errorUtil.errToObj(message) });
  }
  cuid2(message) {
    return this._addCheck({ kind: "cuid2", ...errorUtil.errToObj(message) });
  }
  ulid(message) {
    return this._addCheck({ kind: "ulid", ...errorUtil.errToObj(message) });
  }
  base64(message) {
    return this._addCheck({ kind: "base64", ...errorUtil.errToObj(message) });
  }
  base64url(message) {
    return this._addCheck({
      kind: "base64url",
      ...errorUtil.errToObj(message)
    });
  }
  jwt(options) {
    return this._addCheck({ kind: "jwt", ...errorUtil.errToObj(options) });
  }
  ip(options) {
    return this._addCheck({ kind: "ip", ...errorUtil.errToObj(options) });
  }
  cidr(options) {
    return this._addCheck({ kind: "cidr", ...errorUtil.errToObj(options) });
  }
  datetime(options) {
    if (typeof options === "string") {
      return this._addCheck({
        kind: "datetime",
        precision: null,
        offset: false,
        local: false,
        message: options
      });
    }
    return this._addCheck({
      kind: "datetime",
      precision: typeof options?.precision === "undefined" ? null : options?.precision,
      offset: options?.offset ?? false,
      local: options?.local ?? false,
      ...errorUtil.errToObj(options?.message)
    });
  }
  date(message) {
    return this._addCheck({ kind: "date", message });
  }
  time(options) {
    if (typeof options === "string") {
      return this._addCheck({
        kind: "time",
        precision: null,
        message: options
      });
    }
    return this._addCheck({
      kind: "time",
      precision: typeof options?.precision === "undefined" ? null : options?.precision,
      ...errorUtil.errToObj(options?.message)
    });
  }
  duration(message) {
    return this._addCheck({ kind: "duration", ...errorUtil.errToObj(message) });
  }
  regex(regex, message) {
    return this._addCheck({
      kind: "regex",
      regex,
      ...errorUtil.errToObj(message)
    });
  }
  includes(value, options) {
    return this._addCheck({
      kind: "includes",
      value,
      position: options?.position,
      ...errorUtil.errToObj(options?.message)
    });
  }
  startsWith(value, message) {
    return this._addCheck({
      kind: "startsWith",
      value,
      ...errorUtil.errToObj(message)
    });
  }
  endsWith(value, message) {
    return this._addCheck({
      kind: "endsWith",
      value,
      ...errorUtil.errToObj(message)
    });
  }
  min(minLength, message) {
    return this._addCheck({
      kind: "min",
      value: minLength,
      ...errorUtil.errToObj(message)
    });
  }
  max(maxLength, message) {
    return this._addCheck({
      kind: "max",
      value: maxLength,
      ...errorUtil.errToObj(message)
    });
  }
  length(len, message) {
    return this._addCheck({
      kind: "length",
      value: len,
      ...errorUtil.errToObj(message)
    });
  }
  /**
   * Equivalent to `.min(1)`
   */
  nonempty(message) {
    return this.min(1, errorUtil.errToObj(message));
  }
  trim() {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "trim" }]
    });
  }
  toLowerCase() {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "toLowerCase" }]
    });
  }
  toUpperCase() {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "toUpperCase" }]
    });
  }
  get isDatetime() {
    return !!this._def.checks.find((ch) => ch.kind === "datetime");
  }
  get isDate() {
    return !!this._def.checks.find((ch) => ch.kind === "date");
  }
  get isTime() {
    return !!this._def.checks.find((ch) => ch.kind === "time");
  }
  get isDuration() {
    return !!this._def.checks.find((ch) => ch.kind === "duration");
  }
  get isEmail() {
    return !!this._def.checks.find((ch) => ch.kind === "email");
  }
  get isURL() {
    return !!this._def.checks.find((ch) => ch.kind === "url");
  }
  get isEmoji() {
    return !!this._def.checks.find((ch) => ch.kind === "emoji");
  }
  get isUUID() {
    return !!this._def.checks.find((ch) => ch.kind === "uuid");
  }
  get isNANOID() {
    return !!this._def.checks.find((ch) => ch.kind === "nanoid");
  }
  get isCUID() {
    return !!this._def.checks.find((ch) => ch.kind === "cuid");
  }
  get isCUID2() {
    return !!this._def.checks.find((ch) => ch.kind === "cuid2");
  }
  get isULID() {
    return !!this._def.checks.find((ch) => ch.kind === "ulid");
  }
  get isIP() {
    return !!this._def.checks.find((ch) => ch.kind === "ip");
  }
  get isCIDR() {
    return !!this._def.checks.find((ch) => ch.kind === "cidr");
  }
  get isBase64() {
    return !!this._def.checks.find((ch) => ch.kind === "base64");
  }
  get isBase64url() {
    return !!this._def.checks.find((ch) => ch.kind === "base64url");
  }
  get minLength() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxLength() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
};
ZodString.create = (params) => {
  return new ZodString({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodString,
    coerce: params?.coerce ?? false,
    ...processCreateParams(params)
  });
};
function floatSafeRemainder(val, step) {
  const valDecCount = (val.toString().split(".")[1] || "").length;
  const stepDecCount = (step.toString().split(".")[1] || "").length;
  const decCount = valDecCount > stepDecCount ? valDecCount : stepDecCount;
  const valInt = Number.parseInt(val.toFixed(decCount).replace(".", ""));
  const stepInt = Number.parseInt(step.toFixed(decCount).replace(".", ""));
  return valInt % stepInt / 10 ** decCount;
}
__name(floatSafeRemainder, "floatSafeRemainder");
var ZodNumber = class _ZodNumber extends ZodType {
  static {
    __name(this, "ZodNumber");
  }
  constructor() {
    super(...arguments);
    this.min = this.gte;
    this.max = this.lte;
    this.step = this.multipleOf;
  }
  _parse(input) {
    if (this._def.coerce) {
      input.data = Number(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.number) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.number,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    let ctx = void 0;
    const status = new ParseStatus();
    for (const check of this._def.checks) {
      if (check.kind === "int") {
        if (!util.isInteger(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: "integer",
            received: "float",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "min") {
        const tooSmall = check.inclusive ? input.data < check.value : input.data <= check.value;
        if (tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            minimum: check.value,
            type: "number",
            inclusive: check.inclusive,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        const tooBig = check.inclusive ? input.data > check.value : input.data >= check.value;
        if (tooBig) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            maximum: check.value,
            type: "number",
            inclusive: check.inclusive,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "multipleOf") {
        if (floatSafeRemainder(input.data, check.value) !== 0) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_multiple_of,
            multipleOf: check.value,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "finite") {
        if (!Number.isFinite(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_finite,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  gte(value, message) {
    return this.setLimit("min", value, true, errorUtil.toString(message));
  }
  gt(value, message) {
    return this.setLimit("min", value, false, errorUtil.toString(message));
  }
  lte(value, message) {
    return this.setLimit("max", value, true, errorUtil.toString(message));
  }
  lt(value, message) {
    return this.setLimit("max", value, false, errorUtil.toString(message));
  }
  setLimit(kind, value, inclusive, message) {
    return new _ZodNumber({
      ...this._def,
      checks: [
        ...this._def.checks,
        {
          kind,
          value,
          inclusive,
          message: errorUtil.toString(message)
        }
      ]
    });
  }
  _addCheck(check) {
    return new _ZodNumber({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  int(message) {
    return this._addCheck({
      kind: "int",
      message: errorUtil.toString(message)
    });
  }
  positive(message) {
    return this._addCheck({
      kind: "min",
      value: 0,
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  negative(message) {
    return this._addCheck({
      kind: "max",
      value: 0,
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  nonpositive(message) {
    return this._addCheck({
      kind: "max",
      value: 0,
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  nonnegative(message) {
    return this._addCheck({
      kind: "min",
      value: 0,
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  multipleOf(value, message) {
    return this._addCheck({
      kind: "multipleOf",
      value,
      message: errorUtil.toString(message)
    });
  }
  finite(message) {
    return this._addCheck({
      kind: "finite",
      message: errorUtil.toString(message)
    });
  }
  safe(message) {
    return this._addCheck({
      kind: "min",
      inclusive: true,
      value: Number.MIN_SAFE_INTEGER,
      message: errorUtil.toString(message)
    })._addCheck({
      kind: "max",
      inclusive: true,
      value: Number.MAX_SAFE_INTEGER,
      message: errorUtil.toString(message)
    });
  }
  get minValue() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxValue() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
  get isInt() {
    return !!this._def.checks.find((ch) => ch.kind === "int" || ch.kind === "multipleOf" && util.isInteger(ch.value));
  }
  get isFinite() {
    let max = null;
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "finite" || ch.kind === "int" || ch.kind === "multipleOf") {
        return true;
      } else if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      } else if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return Number.isFinite(min) && Number.isFinite(max);
  }
};
ZodNumber.create = (params) => {
  return new ZodNumber({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodNumber,
    coerce: params?.coerce || false,
    ...processCreateParams(params)
  });
};
var ZodBigInt = class _ZodBigInt extends ZodType {
  static {
    __name(this, "ZodBigInt");
  }
  constructor() {
    super(...arguments);
    this.min = this.gte;
    this.max = this.lte;
  }
  _parse(input) {
    if (this._def.coerce) {
      try {
        input.data = BigInt(input.data);
      } catch {
        return this._getInvalidInput(input);
      }
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.bigint) {
      return this._getInvalidInput(input);
    }
    let ctx = void 0;
    const status = new ParseStatus();
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        const tooSmall = check.inclusive ? input.data < check.value : input.data <= check.value;
        if (tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            type: "bigint",
            minimum: check.value,
            inclusive: check.inclusive,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        const tooBig = check.inclusive ? input.data > check.value : input.data >= check.value;
        if (tooBig) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            type: "bigint",
            maximum: check.value,
            inclusive: check.inclusive,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "multipleOf") {
        if (input.data % check.value !== BigInt(0)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_multiple_of,
            multipleOf: check.value,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  _getInvalidInput(input) {
    const ctx = this._getOrReturnCtx(input);
    addIssueToContext(ctx, {
      code: ZodIssueCode.invalid_type,
      expected: ZodParsedType.bigint,
      received: ctx.parsedType
    });
    return INVALID;
  }
  gte(value, message) {
    return this.setLimit("min", value, true, errorUtil.toString(message));
  }
  gt(value, message) {
    return this.setLimit("min", value, false, errorUtil.toString(message));
  }
  lte(value, message) {
    return this.setLimit("max", value, true, errorUtil.toString(message));
  }
  lt(value, message) {
    return this.setLimit("max", value, false, errorUtil.toString(message));
  }
  setLimit(kind, value, inclusive, message) {
    return new _ZodBigInt({
      ...this._def,
      checks: [
        ...this._def.checks,
        {
          kind,
          value,
          inclusive,
          message: errorUtil.toString(message)
        }
      ]
    });
  }
  _addCheck(check) {
    return new _ZodBigInt({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  positive(message) {
    return this._addCheck({
      kind: "min",
      value: BigInt(0),
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  negative(message) {
    return this._addCheck({
      kind: "max",
      value: BigInt(0),
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  nonpositive(message) {
    return this._addCheck({
      kind: "max",
      value: BigInt(0),
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  nonnegative(message) {
    return this._addCheck({
      kind: "min",
      value: BigInt(0),
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  multipleOf(value, message) {
    return this._addCheck({
      kind: "multipleOf",
      value,
      message: errorUtil.toString(message)
    });
  }
  get minValue() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxValue() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
};
ZodBigInt.create = (params) => {
  return new ZodBigInt({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodBigInt,
    coerce: params?.coerce ?? false,
    ...processCreateParams(params)
  });
};
var ZodBoolean = class extends ZodType {
  static {
    __name(this, "ZodBoolean");
  }
  _parse(input) {
    if (this._def.coerce) {
      input.data = Boolean(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.boolean) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.boolean,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodBoolean.create = (params) => {
  return new ZodBoolean({
    typeName: ZodFirstPartyTypeKind.ZodBoolean,
    coerce: params?.coerce || false,
    ...processCreateParams(params)
  });
};
var ZodDate = class _ZodDate extends ZodType {
  static {
    __name(this, "ZodDate");
  }
  _parse(input) {
    if (this._def.coerce) {
      input.data = new Date(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.date) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.date,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    if (Number.isNaN(input.data.getTime())) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_date
      });
      return INVALID;
    }
    const status = new ParseStatus();
    let ctx = void 0;
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        if (input.data.getTime() < check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            message: check.message,
            inclusive: true,
            exact: false,
            minimum: check.value,
            type: "date"
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        if (input.data.getTime() > check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            message: check.message,
            inclusive: true,
            exact: false,
            maximum: check.value,
            type: "date"
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return {
      status: status.value,
      value: new Date(input.data.getTime())
    };
  }
  _addCheck(check) {
    return new _ZodDate({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  min(minDate, message) {
    return this._addCheck({
      kind: "min",
      value: minDate.getTime(),
      message: errorUtil.toString(message)
    });
  }
  max(maxDate, message) {
    return this._addCheck({
      kind: "max",
      value: maxDate.getTime(),
      message: errorUtil.toString(message)
    });
  }
  get minDate() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min != null ? new Date(min) : null;
  }
  get maxDate() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max != null ? new Date(max) : null;
  }
};
ZodDate.create = (params) => {
  return new ZodDate({
    checks: [],
    coerce: params?.coerce || false,
    typeName: ZodFirstPartyTypeKind.ZodDate,
    ...processCreateParams(params)
  });
};
var ZodSymbol = class extends ZodType {
  static {
    __name(this, "ZodSymbol");
  }
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.symbol) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.symbol,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodSymbol.create = (params) => {
  return new ZodSymbol({
    typeName: ZodFirstPartyTypeKind.ZodSymbol,
    ...processCreateParams(params)
  });
};
var ZodUndefined = class extends ZodType {
  static {
    __name(this, "ZodUndefined");
  }
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.undefined) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.undefined,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodUndefined.create = (params) => {
  return new ZodUndefined({
    typeName: ZodFirstPartyTypeKind.ZodUndefined,
    ...processCreateParams(params)
  });
};
var ZodNull = class extends ZodType {
  static {
    __name(this, "ZodNull");
  }
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.null) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.null,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodNull.create = (params) => {
  return new ZodNull({
    typeName: ZodFirstPartyTypeKind.ZodNull,
    ...processCreateParams(params)
  });
};
var ZodAny = class extends ZodType {
  static {
    __name(this, "ZodAny");
  }
  constructor() {
    super(...arguments);
    this._any = true;
  }
  _parse(input) {
    return OK(input.data);
  }
};
ZodAny.create = (params) => {
  return new ZodAny({
    typeName: ZodFirstPartyTypeKind.ZodAny,
    ...processCreateParams(params)
  });
};
var ZodUnknown = class extends ZodType {
  static {
    __name(this, "ZodUnknown");
  }
  constructor() {
    super(...arguments);
    this._unknown = true;
  }
  _parse(input) {
    return OK(input.data);
  }
};
ZodUnknown.create = (params) => {
  return new ZodUnknown({
    typeName: ZodFirstPartyTypeKind.ZodUnknown,
    ...processCreateParams(params)
  });
};
var ZodNever = class extends ZodType {
  static {
    __name(this, "ZodNever");
  }
  _parse(input) {
    const ctx = this._getOrReturnCtx(input);
    addIssueToContext(ctx, {
      code: ZodIssueCode.invalid_type,
      expected: ZodParsedType.never,
      received: ctx.parsedType
    });
    return INVALID;
  }
};
ZodNever.create = (params) => {
  return new ZodNever({
    typeName: ZodFirstPartyTypeKind.ZodNever,
    ...processCreateParams(params)
  });
};
var ZodVoid = class extends ZodType {
  static {
    __name(this, "ZodVoid");
  }
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.undefined) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.void,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodVoid.create = (params) => {
  return new ZodVoid({
    typeName: ZodFirstPartyTypeKind.ZodVoid,
    ...processCreateParams(params)
  });
};
var ZodArray = class _ZodArray extends ZodType {
  static {
    __name(this, "ZodArray");
  }
  _parse(input) {
    const { ctx, status } = this._processInputParams(input);
    const def = this._def;
    if (ctx.parsedType !== ZodParsedType.array) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.array,
        received: ctx.parsedType
      });
      return INVALID;
    }
    if (def.exactLength !== null) {
      const tooBig = ctx.data.length > def.exactLength.value;
      const tooSmall = ctx.data.length < def.exactLength.value;
      if (tooBig || tooSmall) {
        addIssueToContext(ctx, {
          code: tooBig ? ZodIssueCode.too_big : ZodIssueCode.too_small,
          minimum: tooSmall ? def.exactLength.value : void 0,
          maximum: tooBig ? def.exactLength.value : void 0,
          type: "array",
          inclusive: true,
          exact: true,
          message: def.exactLength.message
        });
        status.dirty();
      }
    }
    if (def.minLength !== null) {
      if (ctx.data.length < def.minLength.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_small,
          minimum: def.minLength.value,
          type: "array",
          inclusive: true,
          exact: false,
          message: def.minLength.message
        });
        status.dirty();
      }
    }
    if (def.maxLength !== null) {
      if (ctx.data.length > def.maxLength.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_big,
          maximum: def.maxLength.value,
          type: "array",
          inclusive: true,
          exact: false,
          message: def.maxLength.message
        });
        status.dirty();
      }
    }
    if (ctx.common.async) {
      return Promise.all([...ctx.data].map((item, i) => {
        return def.type._parseAsync(new ParseInputLazyPath(ctx, item, ctx.path, i));
      })).then((result2) => {
        return ParseStatus.mergeArray(status, result2);
      });
    }
    const result = [...ctx.data].map((item, i) => {
      return def.type._parseSync(new ParseInputLazyPath(ctx, item, ctx.path, i));
    });
    return ParseStatus.mergeArray(status, result);
  }
  get element() {
    return this._def.type;
  }
  min(minLength, message) {
    return new _ZodArray({
      ...this._def,
      minLength: { value: minLength, message: errorUtil.toString(message) }
    });
  }
  max(maxLength, message) {
    return new _ZodArray({
      ...this._def,
      maxLength: { value: maxLength, message: errorUtil.toString(message) }
    });
  }
  length(len, message) {
    return new _ZodArray({
      ...this._def,
      exactLength: { value: len, message: errorUtil.toString(message) }
    });
  }
  nonempty(message) {
    return this.min(1, message);
  }
};
ZodArray.create = (schema, params) => {
  return new ZodArray({
    type: schema,
    minLength: null,
    maxLength: null,
    exactLength: null,
    typeName: ZodFirstPartyTypeKind.ZodArray,
    ...processCreateParams(params)
  });
};
function deepPartialify(schema) {
  if (schema instanceof ZodObject) {
    const newShape = {};
    for (const key in schema.shape) {
      const fieldSchema = schema.shape[key];
      newShape[key] = ZodOptional.create(deepPartialify(fieldSchema));
    }
    return new ZodObject({
      ...schema._def,
      shape: /* @__PURE__ */ __name(() => newShape, "shape")
    });
  } else if (schema instanceof ZodArray) {
    return new ZodArray({
      ...schema._def,
      type: deepPartialify(schema.element)
    });
  } else if (schema instanceof ZodOptional) {
    return ZodOptional.create(deepPartialify(schema.unwrap()));
  } else if (schema instanceof ZodNullable) {
    return ZodNullable.create(deepPartialify(schema.unwrap()));
  } else if (schema instanceof ZodTuple) {
    return ZodTuple.create(schema.items.map((item) => deepPartialify(item)));
  } else {
    return schema;
  }
}
__name(deepPartialify, "deepPartialify");
var ZodObject = class _ZodObject extends ZodType {
  static {
    __name(this, "ZodObject");
  }
  constructor() {
    super(...arguments);
    this._cached = null;
    this.nonstrict = this.passthrough;
    this.augment = this.extend;
  }
  _getCached() {
    if (this._cached !== null)
      return this._cached;
    const shape = this._def.shape();
    const keys = util.objectKeys(shape);
    this._cached = { shape, keys };
    return this._cached;
  }
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.object) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    const { status, ctx } = this._processInputParams(input);
    const { shape, keys: shapeKeys } = this._getCached();
    const extraKeys = [];
    if (!(this._def.catchall instanceof ZodNever && this._def.unknownKeys === "strip")) {
      for (const key in ctx.data) {
        if (!shapeKeys.includes(key)) {
          extraKeys.push(key);
        }
      }
    }
    const pairs = [];
    for (const key of shapeKeys) {
      const keyValidator = shape[key];
      const value = ctx.data[key];
      pairs.push({
        key: { status: "valid", value: key },
        value: keyValidator._parse(new ParseInputLazyPath(ctx, value, ctx.path, key)),
        alwaysSet: key in ctx.data
      });
    }
    if (this._def.catchall instanceof ZodNever) {
      const unknownKeys = this._def.unknownKeys;
      if (unknownKeys === "passthrough") {
        for (const key of extraKeys) {
          pairs.push({
            key: { status: "valid", value: key },
            value: { status: "valid", value: ctx.data[key] }
          });
        }
      } else if (unknownKeys === "strict") {
        if (extraKeys.length > 0) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.unrecognized_keys,
            keys: extraKeys
          });
          status.dirty();
        }
      } else if (unknownKeys === "strip") {
      } else {
        throw new Error(`Internal ZodObject error: invalid unknownKeys value.`);
      }
    } else {
      const catchall = this._def.catchall;
      for (const key of extraKeys) {
        const value = ctx.data[key];
        pairs.push({
          key: { status: "valid", value: key },
          value: catchall._parse(
            new ParseInputLazyPath(ctx, value, ctx.path, key)
            //, ctx.child(key), value, getParsedType(value)
          ),
          alwaysSet: key in ctx.data
        });
      }
    }
    if (ctx.common.async) {
      return Promise.resolve().then(async () => {
        const syncPairs = [];
        for (const pair of pairs) {
          const key = await pair.key;
          const value = await pair.value;
          syncPairs.push({
            key,
            value,
            alwaysSet: pair.alwaysSet
          });
        }
        return syncPairs;
      }).then((syncPairs) => {
        return ParseStatus.mergeObjectSync(status, syncPairs);
      });
    } else {
      return ParseStatus.mergeObjectSync(status, pairs);
    }
  }
  get shape() {
    return this._def.shape();
  }
  strict(message) {
    errorUtil.errToObj;
    return new _ZodObject({
      ...this._def,
      unknownKeys: "strict",
      ...message !== void 0 ? {
        errorMap: /* @__PURE__ */ __name((issue, ctx) => {
          const defaultError = this._def.errorMap?.(issue, ctx).message ?? ctx.defaultError;
          if (issue.code === "unrecognized_keys")
            return {
              message: errorUtil.errToObj(message).message ?? defaultError
            };
          return {
            message: defaultError
          };
        }, "errorMap")
      } : {}
    });
  }
  strip() {
    return new _ZodObject({
      ...this._def,
      unknownKeys: "strip"
    });
  }
  passthrough() {
    return new _ZodObject({
      ...this._def,
      unknownKeys: "passthrough"
    });
  }
  // const AugmentFactory =
  //   <Def extends ZodObjectDef>(def: Def) =>
  //   <Augmentation extends ZodRawShape>(
  //     augmentation: Augmentation
  //   ): ZodObject<
  //     extendShape<ReturnType<Def["shape"]>, Augmentation>,
  //     Def["unknownKeys"],
  //     Def["catchall"]
  //   > => {
  //     return new ZodObject({
  //       ...def,
  //       shape: () => ({
  //         ...def.shape(),
  //         ...augmentation,
  //       }),
  //     }) as any;
  //   };
  extend(augmentation) {
    return new _ZodObject({
      ...this._def,
      shape: /* @__PURE__ */ __name(() => ({
        ...this._def.shape(),
        ...augmentation
      }), "shape")
    });
  }
  /**
   * Prior to zod@1.0.12 there was a bug in the
   * inferred type of merged objects. Please
   * upgrade if you are experiencing issues.
   */
  merge(merging) {
    const merged = new _ZodObject({
      unknownKeys: merging._def.unknownKeys,
      catchall: merging._def.catchall,
      shape: /* @__PURE__ */ __name(() => ({
        ...this._def.shape(),
        ...merging._def.shape()
      }), "shape"),
      typeName: ZodFirstPartyTypeKind.ZodObject
    });
    return merged;
  }
  // merge<
  //   Incoming extends AnyZodObject,
  //   Augmentation extends Incoming["shape"],
  //   NewOutput extends {
  //     [k in keyof Augmentation | keyof Output]: k extends keyof Augmentation
  //       ? Augmentation[k]["_output"]
  //       : k extends keyof Output
  //       ? Output[k]
  //       : never;
  //   },
  //   NewInput extends {
  //     [k in keyof Augmentation | keyof Input]: k extends keyof Augmentation
  //       ? Augmentation[k]["_input"]
  //       : k extends keyof Input
  //       ? Input[k]
  //       : never;
  //   }
  // >(
  //   merging: Incoming
  // ): ZodObject<
  //   extendShape<T, ReturnType<Incoming["_def"]["shape"]>>,
  //   Incoming["_def"]["unknownKeys"],
  //   Incoming["_def"]["catchall"],
  //   NewOutput,
  //   NewInput
  // > {
  //   const merged: any = new ZodObject({
  //     unknownKeys: merging._def.unknownKeys,
  //     catchall: merging._def.catchall,
  //     shape: () =>
  //       objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
  //     typeName: ZodFirstPartyTypeKind.ZodObject,
  //   }) as any;
  //   return merged;
  // }
  setKey(key, schema) {
    return this.augment({ [key]: schema });
  }
  // merge<Incoming extends AnyZodObject>(
  //   merging: Incoming
  // ): //ZodObject<T & Incoming["_shape"], UnknownKeys, Catchall> = (merging) => {
  // ZodObject<
  //   extendShape<T, ReturnType<Incoming["_def"]["shape"]>>,
  //   Incoming["_def"]["unknownKeys"],
  //   Incoming["_def"]["catchall"]
  // > {
  //   // const mergedShape = objectUtil.mergeShapes(
  //   //   this._def.shape(),
  //   //   merging._def.shape()
  //   // );
  //   const merged: any = new ZodObject({
  //     unknownKeys: merging._def.unknownKeys,
  //     catchall: merging._def.catchall,
  //     shape: () =>
  //       objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
  //     typeName: ZodFirstPartyTypeKind.ZodObject,
  //   }) as any;
  //   return merged;
  // }
  catchall(index) {
    return new _ZodObject({
      ...this._def,
      catchall: index
    });
  }
  pick(mask) {
    const shape = {};
    for (const key of util.objectKeys(mask)) {
      if (mask[key] && this.shape[key]) {
        shape[key] = this.shape[key];
      }
    }
    return new _ZodObject({
      ...this._def,
      shape: /* @__PURE__ */ __name(() => shape, "shape")
    });
  }
  omit(mask) {
    const shape = {};
    for (const key of util.objectKeys(this.shape)) {
      if (!mask[key]) {
        shape[key] = this.shape[key];
      }
    }
    return new _ZodObject({
      ...this._def,
      shape: /* @__PURE__ */ __name(() => shape, "shape")
    });
  }
  /**
   * @deprecated
   */
  deepPartial() {
    return deepPartialify(this);
  }
  partial(mask) {
    const newShape = {};
    for (const key of util.objectKeys(this.shape)) {
      const fieldSchema = this.shape[key];
      if (mask && !mask[key]) {
        newShape[key] = fieldSchema;
      } else {
        newShape[key] = fieldSchema.optional();
      }
    }
    return new _ZodObject({
      ...this._def,
      shape: /* @__PURE__ */ __name(() => newShape, "shape")
    });
  }
  required(mask) {
    const newShape = {};
    for (const key of util.objectKeys(this.shape)) {
      if (mask && !mask[key]) {
        newShape[key] = this.shape[key];
      } else {
        const fieldSchema = this.shape[key];
        let newField = fieldSchema;
        while (newField instanceof ZodOptional) {
          newField = newField._def.innerType;
        }
        newShape[key] = newField;
      }
    }
    return new _ZodObject({
      ...this._def,
      shape: /* @__PURE__ */ __name(() => newShape, "shape")
    });
  }
  keyof() {
    return createZodEnum(util.objectKeys(this.shape));
  }
};
ZodObject.create = (shape, params) => {
  return new ZodObject({
    shape: /* @__PURE__ */ __name(() => shape, "shape"),
    unknownKeys: "strip",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params)
  });
};
ZodObject.strictCreate = (shape, params) => {
  return new ZodObject({
    shape: /* @__PURE__ */ __name(() => shape, "shape"),
    unknownKeys: "strict",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params)
  });
};
ZodObject.lazycreate = (shape, params) => {
  return new ZodObject({
    shape,
    unknownKeys: "strip",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params)
  });
};
var ZodUnion = class extends ZodType {
  static {
    __name(this, "ZodUnion");
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const options = this._def.options;
    function handleResults(results) {
      for (const result of results) {
        if (result.result.status === "valid") {
          return result.result;
        }
      }
      for (const result of results) {
        if (result.result.status === "dirty") {
          ctx.common.issues.push(...result.ctx.common.issues);
          return result.result;
        }
      }
      const unionErrors = results.map((result) => new ZodError(result.ctx.common.issues));
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union,
        unionErrors
      });
      return INVALID;
    }
    __name(handleResults, "handleResults");
    if (ctx.common.async) {
      return Promise.all(options.map(async (option) => {
        const childCtx = {
          ...ctx,
          common: {
            ...ctx.common,
            issues: []
          },
          parent: null
        };
        return {
          result: await option._parseAsync({
            data: ctx.data,
            path: ctx.path,
            parent: childCtx
          }),
          ctx: childCtx
        };
      })).then(handleResults);
    } else {
      let dirty = void 0;
      const issues = [];
      for (const option of options) {
        const childCtx = {
          ...ctx,
          common: {
            ...ctx.common,
            issues: []
          },
          parent: null
        };
        const result = option._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: childCtx
        });
        if (result.status === "valid") {
          return result;
        } else if (result.status === "dirty" && !dirty) {
          dirty = { result, ctx: childCtx };
        }
        if (childCtx.common.issues.length) {
          issues.push(childCtx.common.issues);
        }
      }
      if (dirty) {
        ctx.common.issues.push(...dirty.ctx.common.issues);
        return dirty.result;
      }
      const unionErrors = issues.map((issues2) => new ZodError(issues2));
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union,
        unionErrors
      });
      return INVALID;
    }
  }
  get options() {
    return this._def.options;
  }
};
ZodUnion.create = (types, params) => {
  return new ZodUnion({
    options: types,
    typeName: ZodFirstPartyTypeKind.ZodUnion,
    ...processCreateParams(params)
  });
};
var getDiscriminator = /* @__PURE__ */ __name((type) => {
  if (type instanceof ZodLazy) {
    return getDiscriminator(type.schema);
  } else if (type instanceof ZodEffects) {
    return getDiscriminator(type.innerType());
  } else if (type instanceof ZodLiteral) {
    return [type.value];
  } else if (type instanceof ZodEnum) {
    return type.options;
  } else if (type instanceof ZodNativeEnum) {
    return util.objectValues(type.enum);
  } else if (type instanceof ZodDefault) {
    return getDiscriminator(type._def.innerType);
  } else if (type instanceof ZodUndefined) {
    return [void 0];
  } else if (type instanceof ZodNull) {
    return [null];
  } else if (type instanceof ZodOptional) {
    return [void 0, ...getDiscriminator(type.unwrap())];
  } else if (type instanceof ZodNullable) {
    return [null, ...getDiscriminator(type.unwrap())];
  } else if (type instanceof ZodBranded) {
    return getDiscriminator(type.unwrap());
  } else if (type instanceof ZodReadonly) {
    return getDiscriminator(type.unwrap());
  } else if (type instanceof ZodCatch) {
    return getDiscriminator(type._def.innerType);
  } else {
    return [];
  }
}, "getDiscriminator");
var ZodDiscriminatedUnion = class _ZodDiscriminatedUnion extends ZodType {
  static {
    __name(this, "ZodDiscriminatedUnion");
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.object) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const discriminator = this.discriminator;
    const discriminatorValue = ctx.data[discriminator];
    const option = this.optionsMap.get(discriminatorValue);
    if (!option) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union_discriminator,
        options: Array.from(this.optionsMap.keys()),
        path: [discriminator]
      });
      return INVALID;
    }
    if (ctx.common.async) {
      return option._parseAsync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      });
    } else {
      return option._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      });
    }
  }
  get discriminator() {
    return this._def.discriminator;
  }
  get options() {
    return this._def.options;
  }
  get optionsMap() {
    return this._def.optionsMap;
  }
  /**
   * The constructor of the discriminated union schema. Its behaviour is very similar to that of the normal z.union() constructor.
   * However, it only allows a union of objects, all of which need to share a discriminator property. This property must
   * have a different value for each object in the union.
   * @param discriminator the name of the discriminator property
   * @param types an array of object schemas
   * @param params
   */
  static create(discriminator, options, params) {
    const optionsMap = /* @__PURE__ */ new Map();
    for (const type of options) {
      const discriminatorValues = getDiscriminator(type.shape[discriminator]);
      if (!discriminatorValues.length) {
        throw new Error(`A discriminator value for key \`${discriminator}\` could not be extracted from all schema options`);
      }
      for (const value of discriminatorValues) {
        if (optionsMap.has(value)) {
          throw new Error(`Discriminator property ${String(discriminator)} has duplicate value ${String(value)}`);
        }
        optionsMap.set(value, type);
      }
    }
    return new _ZodDiscriminatedUnion({
      typeName: ZodFirstPartyTypeKind.ZodDiscriminatedUnion,
      discriminator,
      options,
      optionsMap,
      ...processCreateParams(params)
    });
  }
};
function mergeValues(a, b) {
  const aType = getParsedType(a);
  const bType = getParsedType(b);
  if (a === b) {
    return { valid: true, data: a };
  } else if (aType === ZodParsedType.object && bType === ZodParsedType.object) {
    const bKeys = util.objectKeys(b);
    const sharedKeys = util.objectKeys(a).filter((key) => bKeys.indexOf(key) !== -1);
    const newObj = { ...a, ...b };
    for (const key of sharedKeys) {
      const sharedValue = mergeValues(a[key], b[key]);
      if (!sharedValue.valid) {
        return { valid: false };
      }
      newObj[key] = sharedValue.data;
    }
    return { valid: true, data: newObj };
  } else if (aType === ZodParsedType.array && bType === ZodParsedType.array) {
    if (a.length !== b.length) {
      return { valid: false };
    }
    const newArray = [];
    for (let index = 0; index < a.length; index++) {
      const itemA = a[index];
      const itemB = b[index];
      const sharedValue = mergeValues(itemA, itemB);
      if (!sharedValue.valid) {
        return { valid: false };
      }
      newArray.push(sharedValue.data);
    }
    return { valid: true, data: newArray };
  } else if (aType === ZodParsedType.date && bType === ZodParsedType.date && +a === +b) {
    return { valid: true, data: a };
  } else {
    return { valid: false };
  }
}
__name(mergeValues, "mergeValues");
var ZodIntersection = class extends ZodType {
  static {
    __name(this, "ZodIntersection");
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    const handleParsed = /* @__PURE__ */ __name((parsedLeft, parsedRight) => {
      if (isAborted(parsedLeft) || isAborted(parsedRight)) {
        return INVALID;
      }
      const merged = mergeValues(parsedLeft.value, parsedRight.value);
      if (!merged.valid) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_intersection_types
        });
        return INVALID;
      }
      if (isDirty(parsedLeft) || isDirty(parsedRight)) {
        status.dirty();
      }
      return { status: status.value, value: merged.data };
    }, "handleParsed");
    if (ctx.common.async) {
      return Promise.all([
        this._def.left._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        }),
        this._def.right._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        })
      ]).then(([left, right]) => handleParsed(left, right));
    } else {
      return handleParsed(this._def.left._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      }), this._def.right._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      }));
    }
  }
};
ZodIntersection.create = (left, right, params) => {
  return new ZodIntersection({
    left,
    right,
    typeName: ZodFirstPartyTypeKind.ZodIntersection,
    ...processCreateParams(params)
  });
};
var ZodTuple = class _ZodTuple extends ZodType {
  static {
    __name(this, "ZodTuple");
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.array) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.array,
        received: ctx.parsedType
      });
      return INVALID;
    }
    if (ctx.data.length < this._def.items.length) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.too_small,
        minimum: this._def.items.length,
        inclusive: true,
        exact: false,
        type: "array"
      });
      return INVALID;
    }
    const rest = this._def.rest;
    if (!rest && ctx.data.length > this._def.items.length) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.too_big,
        maximum: this._def.items.length,
        inclusive: true,
        exact: false,
        type: "array"
      });
      status.dirty();
    }
    const items = [...ctx.data].map((item, itemIndex) => {
      const schema = this._def.items[itemIndex] || this._def.rest;
      if (!schema)
        return null;
      return schema._parse(new ParseInputLazyPath(ctx, item, ctx.path, itemIndex));
    }).filter((x) => !!x);
    if (ctx.common.async) {
      return Promise.all(items).then((results) => {
        return ParseStatus.mergeArray(status, results);
      });
    } else {
      return ParseStatus.mergeArray(status, items);
    }
  }
  get items() {
    return this._def.items;
  }
  rest(rest) {
    return new _ZodTuple({
      ...this._def,
      rest
    });
  }
};
ZodTuple.create = (schemas, params) => {
  if (!Array.isArray(schemas)) {
    throw new Error("You must pass an array of schemas to z.tuple([ ... ])");
  }
  return new ZodTuple({
    items: schemas,
    typeName: ZodFirstPartyTypeKind.ZodTuple,
    rest: null,
    ...processCreateParams(params)
  });
};
var ZodRecord = class _ZodRecord extends ZodType {
  static {
    __name(this, "ZodRecord");
  }
  get keySchema() {
    return this._def.keyType;
  }
  get valueSchema() {
    return this._def.valueType;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.object) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const pairs = [];
    const keyType = this._def.keyType;
    const valueType = this._def.valueType;
    for (const key in ctx.data) {
      pairs.push({
        key: keyType._parse(new ParseInputLazyPath(ctx, key, ctx.path, key)),
        value: valueType._parse(new ParseInputLazyPath(ctx, ctx.data[key], ctx.path, key)),
        alwaysSet: key in ctx.data
      });
    }
    if (ctx.common.async) {
      return ParseStatus.mergeObjectAsync(status, pairs);
    } else {
      return ParseStatus.mergeObjectSync(status, pairs);
    }
  }
  get element() {
    return this._def.valueType;
  }
  static create(first, second, third) {
    if (second instanceof ZodType) {
      return new _ZodRecord({
        keyType: first,
        valueType: second,
        typeName: ZodFirstPartyTypeKind.ZodRecord,
        ...processCreateParams(third)
      });
    }
    return new _ZodRecord({
      keyType: ZodString.create(),
      valueType: first,
      typeName: ZodFirstPartyTypeKind.ZodRecord,
      ...processCreateParams(second)
    });
  }
};
var ZodMap = class extends ZodType {
  static {
    __name(this, "ZodMap");
  }
  get keySchema() {
    return this._def.keyType;
  }
  get valueSchema() {
    return this._def.valueType;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.map) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.map,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const keyType = this._def.keyType;
    const valueType = this._def.valueType;
    const pairs = [...ctx.data.entries()].map(([key, value], index) => {
      return {
        key: keyType._parse(new ParseInputLazyPath(ctx, key, ctx.path, [index, "key"])),
        value: valueType._parse(new ParseInputLazyPath(ctx, value, ctx.path, [index, "value"]))
      };
    });
    if (ctx.common.async) {
      const finalMap = /* @__PURE__ */ new Map();
      return Promise.resolve().then(async () => {
        for (const pair of pairs) {
          const key = await pair.key;
          const value = await pair.value;
          if (key.status === "aborted" || value.status === "aborted") {
            return INVALID;
          }
          if (key.status === "dirty" || value.status === "dirty") {
            status.dirty();
          }
          finalMap.set(key.value, value.value);
        }
        return { status: status.value, value: finalMap };
      });
    } else {
      const finalMap = /* @__PURE__ */ new Map();
      for (const pair of pairs) {
        const key = pair.key;
        const value = pair.value;
        if (key.status === "aborted" || value.status === "aborted") {
          return INVALID;
        }
        if (key.status === "dirty" || value.status === "dirty") {
          status.dirty();
        }
        finalMap.set(key.value, value.value);
      }
      return { status: status.value, value: finalMap };
    }
  }
};
ZodMap.create = (keyType, valueType, params) => {
  return new ZodMap({
    valueType,
    keyType,
    typeName: ZodFirstPartyTypeKind.ZodMap,
    ...processCreateParams(params)
  });
};
var ZodSet = class _ZodSet extends ZodType {
  static {
    __name(this, "ZodSet");
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.set) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.set,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const def = this._def;
    if (def.minSize !== null) {
      if (ctx.data.size < def.minSize.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_small,
          minimum: def.minSize.value,
          type: "set",
          inclusive: true,
          exact: false,
          message: def.minSize.message
        });
        status.dirty();
      }
    }
    if (def.maxSize !== null) {
      if (ctx.data.size > def.maxSize.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_big,
          maximum: def.maxSize.value,
          type: "set",
          inclusive: true,
          exact: false,
          message: def.maxSize.message
        });
        status.dirty();
      }
    }
    const valueType = this._def.valueType;
    function finalizeSet(elements2) {
      const parsedSet = /* @__PURE__ */ new Set();
      for (const element of elements2) {
        if (element.status === "aborted")
          return INVALID;
        if (element.status === "dirty")
          status.dirty();
        parsedSet.add(element.value);
      }
      return { status: status.value, value: parsedSet };
    }
    __name(finalizeSet, "finalizeSet");
    const elements = [...ctx.data.values()].map((item, i) => valueType._parse(new ParseInputLazyPath(ctx, item, ctx.path, i)));
    if (ctx.common.async) {
      return Promise.all(elements).then((elements2) => finalizeSet(elements2));
    } else {
      return finalizeSet(elements);
    }
  }
  min(minSize, message) {
    return new _ZodSet({
      ...this._def,
      minSize: { value: minSize, message: errorUtil.toString(message) }
    });
  }
  max(maxSize, message) {
    return new _ZodSet({
      ...this._def,
      maxSize: { value: maxSize, message: errorUtil.toString(message) }
    });
  }
  size(size, message) {
    return this.min(size, message).max(size, message);
  }
  nonempty(message) {
    return this.min(1, message);
  }
};
ZodSet.create = (valueType, params) => {
  return new ZodSet({
    valueType,
    minSize: null,
    maxSize: null,
    typeName: ZodFirstPartyTypeKind.ZodSet,
    ...processCreateParams(params)
  });
};
var ZodFunction = class _ZodFunction extends ZodType {
  static {
    __name(this, "ZodFunction");
  }
  constructor() {
    super(...arguments);
    this.validate = this.implement;
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.function) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.function,
        received: ctx.parsedType
      });
      return INVALID;
    }
    function makeArgsIssue(args, error) {
      return makeIssue({
        data: args,
        path: ctx.path,
        errorMaps: [ctx.common.contextualErrorMap, ctx.schemaErrorMap, getErrorMap(), en_default].filter((x) => !!x),
        issueData: {
          code: ZodIssueCode.invalid_arguments,
          argumentsError: error
        }
      });
    }
    __name(makeArgsIssue, "makeArgsIssue");
    function makeReturnsIssue(returns, error) {
      return makeIssue({
        data: returns,
        path: ctx.path,
        errorMaps: [ctx.common.contextualErrorMap, ctx.schemaErrorMap, getErrorMap(), en_default].filter((x) => !!x),
        issueData: {
          code: ZodIssueCode.invalid_return_type,
          returnTypeError: error
        }
      });
    }
    __name(makeReturnsIssue, "makeReturnsIssue");
    const params = { errorMap: ctx.common.contextualErrorMap };
    const fn = ctx.data;
    if (this._def.returns instanceof ZodPromise) {
      const me = this;
      return OK(async function(...args) {
        const error = new ZodError([]);
        const parsedArgs = await me._def.args.parseAsync(args, params).catch((e) => {
          error.addIssue(makeArgsIssue(args, e));
          throw error;
        });
        const result = await Reflect.apply(fn, this, parsedArgs);
        const parsedReturns = await me._def.returns._def.type.parseAsync(result, params).catch((e) => {
          error.addIssue(makeReturnsIssue(result, e));
          throw error;
        });
        return parsedReturns;
      });
    } else {
      const me = this;
      return OK(function(...args) {
        const parsedArgs = me._def.args.safeParse(args, params);
        if (!parsedArgs.success) {
          throw new ZodError([makeArgsIssue(args, parsedArgs.error)]);
        }
        const result = Reflect.apply(fn, this, parsedArgs.data);
        const parsedReturns = me._def.returns.safeParse(result, params);
        if (!parsedReturns.success) {
          throw new ZodError([makeReturnsIssue(result, parsedReturns.error)]);
        }
        return parsedReturns.data;
      });
    }
  }
  parameters() {
    return this._def.args;
  }
  returnType() {
    return this._def.returns;
  }
  args(...items) {
    return new _ZodFunction({
      ...this._def,
      args: ZodTuple.create(items).rest(ZodUnknown.create())
    });
  }
  returns(returnType) {
    return new _ZodFunction({
      ...this._def,
      returns: returnType
    });
  }
  implement(func) {
    const validatedFunc = this.parse(func);
    return validatedFunc;
  }
  strictImplement(func) {
    const validatedFunc = this.parse(func);
    return validatedFunc;
  }
  static create(args, returns, params) {
    return new _ZodFunction({
      args: args ? args : ZodTuple.create([]).rest(ZodUnknown.create()),
      returns: returns || ZodUnknown.create(),
      typeName: ZodFirstPartyTypeKind.ZodFunction,
      ...processCreateParams(params)
    });
  }
};
var ZodLazy = class extends ZodType {
  static {
    __name(this, "ZodLazy");
  }
  get schema() {
    return this._def.getter();
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const lazySchema = this._def.getter();
    return lazySchema._parse({ data: ctx.data, path: ctx.path, parent: ctx });
  }
};
ZodLazy.create = (getter, params) => {
  return new ZodLazy({
    getter,
    typeName: ZodFirstPartyTypeKind.ZodLazy,
    ...processCreateParams(params)
  });
};
var ZodLiteral = class extends ZodType {
  static {
    __name(this, "ZodLiteral");
  }
  _parse(input) {
    if (input.data !== this._def.value) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_literal,
        expected: this._def.value
      });
      return INVALID;
    }
    return { status: "valid", value: input.data };
  }
  get value() {
    return this._def.value;
  }
};
ZodLiteral.create = (value, params) => {
  return new ZodLiteral({
    value,
    typeName: ZodFirstPartyTypeKind.ZodLiteral,
    ...processCreateParams(params)
  });
};
function createZodEnum(values, params) {
  return new ZodEnum({
    values,
    typeName: ZodFirstPartyTypeKind.ZodEnum,
    ...processCreateParams(params)
  });
}
__name(createZodEnum, "createZodEnum");
var ZodEnum = class _ZodEnum extends ZodType {
  static {
    __name(this, "ZodEnum");
  }
  _parse(input) {
    if (typeof input.data !== "string") {
      const ctx = this._getOrReturnCtx(input);
      const expectedValues = this._def.values;
      addIssueToContext(ctx, {
        expected: util.joinValues(expectedValues),
        received: ctx.parsedType,
        code: ZodIssueCode.invalid_type
      });
      return INVALID;
    }
    if (!this._cache) {
      this._cache = new Set(this._def.values);
    }
    if (!this._cache.has(input.data)) {
      const ctx = this._getOrReturnCtx(input);
      const expectedValues = this._def.values;
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_enum_value,
        options: expectedValues
      });
      return INVALID;
    }
    return OK(input.data);
  }
  get options() {
    return this._def.values;
  }
  get enum() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  get Values() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  get Enum() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  extract(values, newDef = this._def) {
    return _ZodEnum.create(values, {
      ...this._def,
      ...newDef
    });
  }
  exclude(values, newDef = this._def) {
    return _ZodEnum.create(this.options.filter((opt) => !values.includes(opt)), {
      ...this._def,
      ...newDef
    });
  }
};
ZodEnum.create = createZodEnum;
var ZodNativeEnum = class extends ZodType {
  static {
    __name(this, "ZodNativeEnum");
  }
  _parse(input) {
    const nativeEnumValues = util.getValidEnumValues(this._def.values);
    const ctx = this._getOrReturnCtx(input);
    if (ctx.parsedType !== ZodParsedType.string && ctx.parsedType !== ZodParsedType.number) {
      const expectedValues = util.objectValues(nativeEnumValues);
      addIssueToContext(ctx, {
        expected: util.joinValues(expectedValues),
        received: ctx.parsedType,
        code: ZodIssueCode.invalid_type
      });
      return INVALID;
    }
    if (!this._cache) {
      this._cache = new Set(util.getValidEnumValues(this._def.values));
    }
    if (!this._cache.has(input.data)) {
      const expectedValues = util.objectValues(nativeEnumValues);
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_enum_value,
        options: expectedValues
      });
      return INVALID;
    }
    return OK(input.data);
  }
  get enum() {
    return this._def.values;
  }
};
ZodNativeEnum.create = (values, params) => {
  return new ZodNativeEnum({
    values,
    typeName: ZodFirstPartyTypeKind.ZodNativeEnum,
    ...processCreateParams(params)
  });
};
var ZodPromise = class extends ZodType {
  static {
    __name(this, "ZodPromise");
  }
  unwrap() {
    return this._def.type;
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.promise && ctx.common.async === false) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.promise,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const promisified = ctx.parsedType === ZodParsedType.promise ? ctx.data : Promise.resolve(ctx.data);
    return OK(promisified.then((data) => {
      return this._def.type.parseAsync(data, {
        path: ctx.path,
        errorMap: ctx.common.contextualErrorMap
      });
    }));
  }
};
ZodPromise.create = (schema, params) => {
  return new ZodPromise({
    type: schema,
    typeName: ZodFirstPartyTypeKind.ZodPromise,
    ...processCreateParams(params)
  });
};
var ZodEffects = class extends ZodType {
  static {
    __name(this, "ZodEffects");
  }
  innerType() {
    return this._def.schema;
  }
  sourceType() {
    return this._def.schema._def.typeName === ZodFirstPartyTypeKind.ZodEffects ? this._def.schema.sourceType() : this._def.schema;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    const effect = this._def.effect || null;
    const checkCtx = {
      addIssue: /* @__PURE__ */ __name((arg) => {
        addIssueToContext(ctx, arg);
        if (arg.fatal) {
          status.abort();
        } else {
          status.dirty();
        }
      }, "addIssue"),
      get path() {
        return ctx.path;
      }
    };
    checkCtx.addIssue = checkCtx.addIssue.bind(checkCtx);
    if (effect.type === "preprocess") {
      const processed = effect.transform(ctx.data, checkCtx);
      if (ctx.common.async) {
        return Promise.resolve(processed).then(async (processed2) => {
          if (status.value === "aborted")
            return INVALID;
          const result = await this._def.schema._parseAsync({
            data: processed2,
            path: ctx.path,
            parent: ctx
          });
          if (result.status === "aborted")
            return INVALID;
          if (result.status === "dirty")
            return DIRTY(result.value);
          if (status.value === "dirty")
            return DIRTY(result.value);
          return result;
        });
      } else {
        if (status.value === "aborted")
          return INVALID;
        const result = this._def.schema._parseSync({
          data: processed,
          path: ctx.path,
          parent: ctx
        });
        if (result.status === "aborted")
          return INVALID;
        if (result.status === "dirty")
          return DIRTY(result.value);
        if (status.value === "dirty")
          return DIRTY(result.value);
        return result;
      }
    }
    if (effect.type === "refinement") {
      const executeRefinement = /* @__PURE__ */ __name((acc) => {
        const result = effect.refinement(acc, checkCtx);
        if (ctx.common.async) {
          return Promise.resolve(result);
        }
        if (result instanceof Promise) {
          throw new Error("Async refinement encountered during synchronous parse operation. Use .parseAsync instead.");
        }
        return acc;
      }, "executeRefinement");
      if (ctx.common.async === false) {
        const inner = this._def.schema._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (inner.status === "aborted")
          return INVALID;
        if (inner.status === "dirty")
          status.dirty();
        executeRefinement(inner.value);
        return { status: status.value, value: inner.value };
      } else {
        return this._def.schema._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx }).then((inner) => {
          if (inner.status === "aborted")
            return INVALID;
          if (inner.status === "dirty")
            status.dirty();
          return executeRefinement(inner.value).then(() => {
            return { status: status.value, value: inner.value };
          });
        });
      }
    }
    if (effect.type === "transform") {
      if (ctx.common.async === false) {
        const base = this._def.schema._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (!isValid(base))
          return INVALID;
        const result = effect.transform(base.value, checkCtx);
        if (result instanceof Promise) {
          throw new Error(`Asynchronous transform encountered during synchronous parse operation. Use .parseAsync instead.`);
        }
        return { status: status.value, value: result };
      } else {
        return this._def.schema._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx }).then((base) => {
          if (!isValid(base))
            return INVALID;
          return Promise.resolve(effect.transform(base.value, checkCtx)).then((result) => ({
            status: status.value,
            value: result
          }));
        });
      }
    }
    util.assertNever(effect);
  }
};
ZodEffects.create = (schema, effect, params) => {
  return new ZodEffects({
    schema,
    typeName: ZodFirstPartyTypeKind.ZodEffects,
    effect,
    ...processCreateParams(params)
  });
};
ZodEffects.createWithPreprocess = (preprocess, schema, params) => {
  return new ZodEffects({
    schema,
    effect: { type: "preprocess", transform: preprocess },
    typeName: ZodFirstPartyTypeKind.ZodEffects,
    ...processCreateParams(params)
  });
};
var ZodOptional = class extends ZodType {
  static {
    __name(this, "ZodOptional");
  }
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType === ZodParsedType.undefined) {
      return OK(void 0);
    }
    return this._def.innerType._parse(input);
  }
  unwrap() {
    return this._def.innerType;
  }
};
ZodOptional.create = (type, params) => {
  return new ZodOptional({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodOptional,
    ...processCreateParams(params)
  });
};
var ZodNullable = class extends ZodType {
  static {
    __name(this, "ZodNullable");
  }
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType === ZodParsedType.null) {
      return OK(null);
    }
    return this._def.innerType._parse(input);
  }
  unwrap() {
    return this._def.innerType;
  }
};
ZodNullable.create = (type, params) => {
  return new ZodNullable({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodNullable,
    ...processCreateParams(params)
  });
};
var ZodDefault = class extends ZodType {
  static {
    __name(this, "ZodDefault");
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    let data = ctx.data;
    if (ctx.parsedType === ZodParsedType.undefined) {
      data = this._def.defaultValue();
    }
    return this._def.innerType._parse({
      data,
      path: ctx.path,
      parent: ctx
    });
  }
  removeDefault() {
    return this._def.innerType;
  }
};
ZodDefault.create = (type, params) => {
  return new ZodDefault({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodDefault,
    defaultValue: typeof params.default === "function" ? params.default : () => params.default,
    ...processCreateParams(params)
  });
};
var ZodCatch = class extends ZodType {
  static {
    __name(this, "ZodCatch");
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const newCtx = {
      ...ctx,
      common: {
        ...ctx.common,
        issues: []
      }
    };
    const result = this._def.innerType._parse({
      data: newCtx.data,
      path: newCtx.path,
      parent: {
        ...newCtx
      }
    });
    if (isAsync(result)) {
      return result.then((result2) => {
        return {
          status: "valid",
          value: result2.status === "valid" ? result2.value : this._def.catchValue({
            get error() {
              return new ZodError(newCtx.common.issues);
            },
            input: newCtx.data
          })
        };
      });
    } else {
      return {
        status: "valid",
        value: result.status === "valid" ? result.value : this._def.catchValue({
          get error() {
            return new ZodError(newCtx.common.issues);
          },
          input: newCtx.data
        })
      };
    }
  }
  removeCatch() {
    return this._def.innerType;
  }
};
ZodCatch.create = (type, params) => {
  return new ZodCatch({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodCatch,
    catchValue: typeof params.catch === "function" ? params.catch : () => params.catch,
    ...processCreateParams(params)
  });
};
var ZodNaN = class extends ZodType {
  static {
    __name(this, "ZodNaN");
  }
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.nan) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.nan,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return { status: "valid", value: input.data };
  }
};
ZodNaN.create = (params) => {
  return new ZodNaN({
    typeName: ZodFirstPartyTypeKind.ZodNaN,
    ...processCreateParams(params)
  });
};
var BRAND = /* @__PURE__ */ Symbol("zod_brand");
var ZodBranded = class extends ZodType {
  static {
    __name(this, "ZodBranded");
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const data = ctx.data;
    return this._def.type._parse({
      data,
      path: ctx.path,
      parent: ctx
    });
  }
  unwrap() {
    return this._def.type;
  }
};
var ZodPipeline = class _ZodPipeline extends ZodType {
  static {
    __name(this, "ZodPipeline");
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.common.async) {
      const handleAsync = /* @__PURE__ */ __name(async () => {
        const inResult = await this._def.in._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (inResult.status === "aborted")
          return INVALID;
        if (inResult.status === "dirty") {
          status.dirty();
          return DIRTY(inResult.value);
        } else {
          return this._def.out._parseAsync({
            data: inResult.value,
            path: ctx.path,
            parent: ctx
          });
        }
      }, "handleAsync");
      return handleAsync();
    } else {
      const inResult = this._def.in._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      });
      if (inResult.status === "aborted")
        return INVALID;
      if (inResult.status === "dirty") {
        status.dirty();
        return {
          status: "dirty",
          value: inResult.value
        };
      } else {
        return this._def.out._parseSync({
          data: inResult.value,
          path: ctx.path,
          parent: ctx
        });
      }
    }
  }
  static create(a, b) {
    return new _ZodPipeline({
      in: a,
      out: b,
      typeName: ZodFirstPartyTypeKind.ZodPipeline
    });
  }
};
var ZodReadonly = class extends ZodType {
  static {
    __name(this, "ZodReadonly");
  }
  _parse(input) {
    const result = this._def.innerType._parse(input);
    const freeze = /* @__PURE__ */ __name((data) => {
      if (isValid(data)) {
        data.value = Object.freeze(data.value);
      }
      return data;
    }, "freeze");
    return isAsync(result) ? result.then((data) => freeze(data)) : freeze(result);
  }
  unwrap() {
    return this._def.innerType;
  }
};
ZodReadonly.create = (type, params) => {
  return new ZodReadonly({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodReadonly,
    ...processCreateParams(params)
  });
};
function cleanParams(params, data) {
  const p = typeof params === "function" ? params(data) : typeof params === "string" ? { message: params } : params;
  const p2 = typeof p === "string" ? { message: p } : p;
  return p2;
}
__name(cleanParams, "cleanParams");
function custom(check, _params = {}, fatal) {
  if (check)
    return ZodAny.create().superRefine((data, ctx) => {
      const r = check(data);
      if (r instanceof Promise) {
        return r.then((r2) => {
          if (!r2) {
            const params = cleanParams(_params, data);
            const _fatal = params.fatal ?? fatal ?? true;
            ctx.addIssue({ code: "custom", ...params, fatal: _fatal });
          }
        });
      }
      if (!r) {
        const params = cleanParams(_params, data);
        const _fatal = params.fatal ?? fatal ?? true;
        ctx.addIssue({ code: "custom", ...params, fatal: _fatal });
      }
      return;
    });
  return ZodAny.create();
}
__name(custom, "custom");
var late = {
  object: ZodObject.lazycreate
};
var ZodFirstPartyTypeKind;
(function(ZodFirstPartyTypeKind2) {
  ZodFirstPartyTypeKind2["ZodString"] = "ZodString";
  ZodFirstPartyTypeKind2["ZodNumber"] = "ZodNumber";
  ZodFirstPartyTypeKind2["ZodNaN"] = "ZodNaN";
  ZodFirstPartyTypeKind2["ZodBigInt"] = "ZodBigInt";
  ZodFirstPartyTypeKind2["ZodBoolean"] = "ZodBoolean";
  ZodFirstPartyTypeKind2["ZodDate"] = "ZodDate";
  ZodFirstPartyTypeKind2["ZodSymbol"] = "ZodSymbol";
  ZodFirstPartyTypeKind2["ZodUndefined"] = "ZodUndefined";
  ZodFirstPartyTypeKind2["ZodNull"] = "ZodNull";
  ZodFirstPartyTypeKind2["ZodAny"] = "ZodAny";
  ZodFirstPartyTypeKind2["ZodUnknown"] = "ZodUnknown";
  ZodFirstPartyTypeKind2["ZodNever"] = "ZodNever";
  ZodFirstPartyTypeKind2["ZodVoid"] = "ZodVoid";
  ZodFirstPartyTypeKind2["ZodArray"] = "ZodArray";
  ZodFirstPartyTypeKind2["ZodObject"] = "ZodObject";
  ZodFirstPartyTypeKind2["ZodUnion"] = "ZodUnion";
  ZodFirstPartyTypeKind2["ZodDiscriminatedUnion"] = "ZodDiscriminatedUnion";
  ZodFirstPartyTypeKind2["ZodIntersection"] = "ZodIntersection";
  ZodFirstPartyTypeKind2["ZodTuple"] = "ZodTuple";
  ZodFirstPartyTypeKind2["ZodRecord"] = "ZodRecord";
  ZodFirstPartyTypeKind2["ZodMap"] = "ZodMap";
  ZodFirstPartyTypeKind2["ZodSet"] = "ZodSet";
  ZodFirstPartyTypeKind2["ZodFunction"] = "ZodFunction";
  ZodFirstPartyTypeKind2["ZodLazy"] = "ZodLazy";
  ZodFirstPartyTypeKind2["ZodLiteral"] = "ZodLiteral";
  ZodFirstPartyTypeKind2["ZodEnum"] = "ZodEnum";
  ZodFirstPartyTypeKind2["ZodEffects"] = "ZodEffects";
  ZodFirstPartyTypeKind2["ZodNativeEnum"] = "ZodNativeEnum";
  ZodFirstPartyTypeKind2["ZodOptional"] = "ZodOptional";
  ZodFirstPartyTypeKind2["ZodNullable"] = "ZodNullable";
  ZodFirstPartyTypeKind2["ZodDefault"] = "ZodDefault";
  ZodFirstPartyTypeKind2["ZodCatch"] = "ZodCatch";
  ZodFirstPartyTypeKind2["ZodPromise"] = "ZodPromise";
  ZodFirstPartyTypeKind2["ZodBranded"] = "ZodBranded";
  ZodFirstPartyTypeKind2["ZodPipeline"] = "ZodPipeline";
  ZodFirstPartyTypeKind2["ZodReadonly"] = "ZodReadonly";
})(ZodFirstPartyTypeKind || (ZodFirstPartyTypeKind = {}));
var instanceOfType = /* @__PURE__ */ __name((cls, params = {
  message: `Input not instance of ${cls.name}`
}) => custom((data) => data instanceof cls, params), "instanceOfType");
var stringType = ZodString.create;
var numberType = ZodNumber.create;
var nanType = ZodNaN.create;
var bigIntType = ZodBigInt.create;
var booleanType = ZodBoolean.create;
var dateType = ZodDate.create;
var symbolType = ZodSymbol.create;
var undefinedType = ZodUndefined.create;
var nullType = ZodNull.create;
var anyType = ZodAny.create;
var unknownType = ZodUnknown.create;
var neverType = ZodNever.create;
var voidType = ZodVoid.create;
var arrayType = ZodArray.create;
var objectType = ZodObject.create;
var strictObjectType = ZodObject.strictCreate;
var unionType = ZodUnion.create;
var discriminatedUnionType = ZodDiscriminatedUnion.create;
var intersectionType = ZodIntersection.create;
var tupleType = ZodTuple.create;
var recordType = ZodRecord.create;
var mapType = ZodMap.create;
var setType = ZodSet.create;
var functionType = ZodFunction.create;
var lazyType = ZodLazy.create;
var literalType = ZodLiteral.create;
var enumType = ZodEnum.create;
var nativeEnumType = ZodNativeEnum.create;
var promiseType = ZodPromise.create;
var effectsType = ZodEffects.create;
var optionalType = ZodOptional.create;
var nullableType = ZodNullable.create;
var preprocessType = ZodEffects.createWithPreprocess;
var pipelineType = ZodPipeline.create;
var ostring = /* @__PURE__ */ __name(() => stringType().optional(), "ostring");
var onumber = /* @__PURE__ */ __name(() => numberType().optional(), "onumber");
var oboolean = /* @__PURE__ */ __name(() => booleanType().optional(), "oboolean");
var coerce = {
  string: /* @__PURE__ */ __name(((arg) => ZodString.create({ ...arg, coerce: true })), "string"),
  number: /* @__PURE__ */ __name(((arg) => ZodNumber.create({ ...arg, coerce: true })), "number"),
  boolean: /* @__PURE__ */ __name(((arg) => ZodBoolean.create({
    ...arg,
    coerce: true
  })), "boolean"),
  bigint: /* @__PURE__ */ __name(((arg) => ZodBigInt.create({ ...arg, coerce: true })), "bigint"),
  date: /* @__PURE__ */ __name(((arg) => ZodDate.create({ ...arg, coerce: true })), "date")
};
var NEVER = INVALID;

// worker/crypto.ts
var encoder = new TextEncoder();
function base64UrlEncode(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}
__name(base64UrlEncode, "base64UrlEncode");
function base64UrlDecode(value) {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  try {
    return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
  } catch {
    throw new HttpError(500, "invalid_server_key");
  }
}
__name(base64UrlDecode, "base64UrlDecode");
function decodeSecretKey(value) {
  if (/^[0-9a-f]{64}$/i.test(value)) {
    return Uint8Array.from(value.match(/.{2}/g) ?? [], (pair) => Number.parseInt(pair, 16));
  }
  if (!/^[A-Za-z0-9+/_-]{43}=?$/.test(value)) throw new HttpError(500, "invalid_server_key");
  const bytes = base64UrlDecode(value);
  if (bytes.byteLength !== 32) throw new HttpError(500, "invalid_server_key");
  return bytes;
}
__name(decodeSecretKey, "decodeSecretKey");
async function sha256(value) {
  return base64UrlEncode(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value))));
}
__name(sha256, "sha256");
function randomToken(bytes = 32) {
  return base64UrlEncode(crypto.getRandomValues(new Uint8Array(bytes)));
}
__name(randomToken, "randomToken");

// worker/security/encryption.ts
var encoder2 = new TextEncoder();
var decoder = new TextDecoder();
var KEY_CONTEXT = encoder2.encode("a-step:pii:v1:aes-256-gcm");
var KEY_SALT = encoder2.encode("a-step:pii:key-derivation:v1");
async function deriveEncryptionKey(secret2) {
  const secretBytes = decodeSecretKey(secret2);
  const keyMaterial = await crypto.subtle.importKey("raw", secretBytes, "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: KEY_SALT, info: KEY_CONTEXT },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}
__name(deriveEncryptionKey, "deriveEncryptionKey");
async function encryptPii(value, versionedSecret) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: KEY_CONTEXT },
    await deriveEncryptionKey(versionedSecret),
    encoder2.encode(value)
  );
  return `v1.${base64UrlEncode(iv)}.${base64UrlEncode(new Uint8Array(ciphertext))}`;
}
__name(encryptPii, "encryptPii");
async function decryptPii(value, versionedSecret) {
  const [version, encodedIv, encodedCiphertext, extra] = value.split(".");
  if (version !== "v1" || !encodedIv || !encodedCiphertext || extra) {
    throw new HttpError(500, "invalid_ciphertext");
  }
  try {
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: base64UrlDecode(encodedIv), additionalData: KEY_CONTEXT },
      await deriveEncryptionKey(versionedSecret),
      base64UrlDecode(encodedCiphertext)
    );
    return decoder.decode(plaintext);
  } catch {
    throw new HttpError(500, "invalid_ciphertext");
  }
}
__name(decryptPii, "decryptPii");

// worker/security/resource-ref.ts
var encoder3 = new TextEncoder();
var decoder2 = new TextDecoder();
var KEY_SALT2 = encoder3.encode("a-step:resource-ref:key-derivation:v1");
var KEY_CONTEXT2 = encoder3.encode("a-step:resource-ref:v1");
async function deriveKey(secret2) {
  const bytes = base64UrlDecode(secret2);
  if (bytes.byteLength < 32) throw new HttpError(500, "invalid_server_key");
  const material = await crypto.subtle.importKey("raw", bytes, "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: KEY_SALT2, info: KEY_CONTEXT2 },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}
__name(deriveKey, "deriveKey");
async function createResourceRef(recordId, type, userId, secret2) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = encoder3.encode(`${type}\0${userId}\0${recordId}`);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: KEY_CONTEXT2 },
    await deriveKey(secret2),
    plaintext
  );
  return `r1.${base64UrlEncode(iv)}.${base64UrlEncode(new Uint8Array(ciphertext))}`;
}
__name(createResourceRef, "createResourceRef");
async function resolveResourceRef(resourceRef, expectedType, userId, secret2) {
  const [version, encodedIv, encodedCiphertext, extra] = resourceRef.split(".");
  if (version !== "r1" || !encodedIv || !encodedCiphertext || extra) throw new HttpError(404, "not_found");
  try {
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: base64UrlDecode(encodedIv), additionalData: KEY_CONTEXT2 },
      await deriveKey(secret2),
      base64UrlDecode(encodedCiphertext)
    );
    const [type, ownerId, recordId, unexpected] = decoder2.decode(plaintext).split("\0");
    if (unexpected || type !== expectedType || ownerId !== userId || recordId.length !== 36 || !/^[0-9a-f-]{36}$/i.test(recordId)) {
      throw new Error("invalid_resource_ref");
    }
    return recordId;
  } catch {
    throw new HttpError(404, "not_found");
  }
}
__name(resolveResourceRef, "resolveResourceRef");

// worker/admin-api.ts
var copySchema = external_exports.object({ title: external_exports.string().trim().min(1).max(180), description: external_exports.string().trim().min(1).max(4e3) }).strict();
var translationsSchema = external_exports.object({ en: copySchema, fr: copySchema, ar: copySchema }).strict();
var nullableGuidePath = external_exports.string().trim().max(512).regex(/^[a-z0-9][a-z0-9._/-]*\.pdf$/).refine((value) => !value.includes("..") && !value.includes("//")).nullable();
var nullableImagePath = external_exports.string().max(512).regex(/^\/assets\/opportunities\/[a-z0-9._-]+\.(?:png|jpe?g|webp|avif)$/).nullable();
var resourceRefSchema = external_exports.string().min(64).max(512).regex(/^r1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
var guideSchema = external_exports.object({
  id: resourceRefSchema.optional(),
  slug: external_exports.string().trim().min(1).max(120).regex(/^[a-z0-9-]+$/),
  category: external_exports.string().trim().min(1).max(80),
  filePath: nullableGuidePath,
  fileType: external_exports.literal("PDF"),
  pageCount: external_exports.number().int().min(1).max(2e3),
  coverPath: external_exports.string().max(512).regex(/^\/assets\/[a-z0-9/_-]+\.(?:png|jpe?g|webp|avif)$/).nullable(),
  published: external_exports.boolean(),
  sortOrder: external_exports.number().int().min(0).max(1e4),
  contentUpdatedAt: external_exports.string().max(10).regex(/^\d{4}-\d{2}-\d{2}$/),
  translations: translationsSchema
}).strict();
var opportunitySchema = external_exports.object({
  id: resourceRefSchema.optional(),
  slug: external_exports.string().trim().min(1).max(120).regex(/^[a-z0-9-]+$/),
  country: external_exports.string().trim().min(1).max(80),
  categories: external_exports.array(external_exports.string().trim().min(1).max(80)).min(1).max(12),
  imagePath: nullableImagePath,
  applyUrl: external_exports.string().url().refine((value) => value.startsWith("https://")).nullable(),
  opensAt: external_exports.string().max(10).regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  deadline: external_exports.string().max(10).regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  featured: external_exports.boolean(),
  published: external_exports.boolean(),
  translations: translationsSchema
}).strict();
function parsedJson(value, schema) {
  try {
    return schema.parse(JSON.parse(value));
  } catch {
    throw new HttpError(503, "invalid_stored_data");
  }
}
__name(parsedJson, "parsedJson");
async function mutate(statement) {
  try {
    const result = await statement.run();
    if (result.meta.changes !== 1) throw new HttpError(404, "not_found");
  } catch (error) {
    if (error instanceof HttpError) throw error;
    if (error instanceof Error && error.message.includes("UNIQUE constraint failed")) throw new HttpError(409, "conflict");
    throw new HttpError(503, "service_unavailable");
  }
}
__name(mutate, "mutate");
async function guideFromRow(row, env, identity) {
  return {
    id: await createResourceRef(row.id, "guide", identity.id, env.SESSION_SECRET),
    slug: row.slug,
    category: row.category,
    filePath: row.storage_object_path,
    fileType: row.file_type,
    pageCount: row.page_count,
    coverPath: row.cover_path,
    published: row.published === 1,
    sortOrder: row.sort_order,
    contentUpdatedAt: row.content_updated_at,
    translations: parsedJson(row.translations, translationsSchema)
  };
}
__name(guideFromRow, "guideFromRow");
async function opportunityFromRow(row, env, identity) {
  return {
    id: await createResourceRef(row.id, "opportunity", identity.id, env.SESSION_SECRET),
    slug: row.slug,
    country: row.country,
    categories: parsedJson(row.categories, external_exports.array(external_exports.string())),
    imagePath: row.image_path,
    applyUrl: row.apply_url,
    opensAt: row.opens_at,
    deadline: row.deadline,
    featured: row.featured === 1,
    published: row.published === 1,
    translations: parsedJson(row.translations, translationsSchema)
  };
}
__name(opportunityFromRow, "opportunityFromRow");
async function guides(request, env, identity, id) {
  if (request.method === "GET" && !id) {
    const { results } = await env.DB.prepare(
      `SELECT id, slug, category, storage_object_path, file_type, page_count, cover_path,
       published, sort_order, content_updated_at, translations
       FROM guides WHERE user_id = ?1 ORDER BY sort_order ASC LIMIT 100`
    ).bind(identity.id).all();
    return json({ items: await Promise.all(results.map((row) => guideFromRow(row, env, identity))) });
  }
  if (id && !resourceRefSchema.safeParse(id).success) throw new HttpError(404, "not_found");
  if (request.method === "POST" && !id) {
    const parsed = guideSchema.safeParse(await readJson(request, 65536));
    if (!parsed.success || parsed.data.id) throw new HttpError(400, "validation_failed");
    const input = parsed.data;
    const databaseId = crypto.randomUUID();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    await mutate(env.DB.prepare(
      `INSERT INTO guides
        (id, user_id, slug, category, storage_object_path, file_type, page_count, cover_path,
         published, sort_order, content_updated_at, translations, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?13)`
    ).bind(
      databaseId,
      identity.id,
      input.slug,
      input.category,
      input.filePath,
      input.fileType,
      input.pageCount,
      input.coverPath,
      input.published ? 1 : 0,
      input.sortOrder,
      input.contentUpdatedAt,
      JSON.stringify(input.translations),
      now
    ));
    return json({
      success: true,
      resourceId: await createResourceRef(databaseId, "guide", identity.id, env.SESSION_SECRET)
    }, 201);
  }
  if (request.method === "PUT" && id) {
    const parsed = guideSchema.safeParse(await readJson(request, 65536));
    if (!parsed.success || parsed.data.id && parsed.data.id !== id) throw new HttpError(400, "validation_failed");
    const input = parsed.data;
    const databaseId = await resolveResourceRef(id, "guide", identity.id, env.SESSION_SECRET);
    await mutate(env.DB.prepare(
      `UPDATE guides SET slug = ?1, category = ?2, storage_object_path = ?3, file_type = ?4,
       page_count = ?5, cover_path = ?6, published = ?7, sort_order = ?8,
       content_updated_at = ?9, translations = ?10, updated_at = ?11
       WHERE id = ?12 AND user_id = ?13`
    ).bind(
      input.slug,
      input.category,
      input.filePath,
      input.fileType,
      input.pageCount,
      input.coverPath,
      input.published ? 1 : 0,
      input.sortOrder,
      input.contentUpdatedAt,
      JSON.stringify(input.translations),
      (/* @__PURE__ */ new Date()).toISOString(),
      databaseId,
      identity.id
    ));
    return json({ success: true });
  }
  if (request.method === "DELETE" && id) {
    const databaseId = await resolveResourceRef(id, "guide", identity.id, env.SESSION_SECRET);
    await mutate(env.DB.prepare("DELETE FROM guides WHERE id = ?1 AND user_id = ?2").bind(databaseId, identity.id));
    return json({ success: true });
  }
  throw new HttpError(405, "method_not_allowed");
}
__name(guides, "guides");
async function opportunities(request, env, identity, id) {
  if (request.method === "GET" && !id) {
    const { results } = await env.DB.prepare(
      `SELECT id, slug, country, categories, image_path, apply_url, opens_at, deadline,
       featured, published, translations FROM opportunities
       WHERE user_id = ?1 ORDER BY deadline IS NULL ASC, deadline ASC LIMIT 100`
    ).bind(identity.id).all();
    return json({ items: await Promise.all(results.map((row) => opportunityFromRow(row, env, identity))) });
  }
  if (id && !resourceRefSchema.safeParse(id).success) throw new HttpError(404, "not_found");
  if (request.method === "POST" && !id) {
    const parsed = opportunitySchema.safeParse(await readJson(request, 65536));
    if (!parsed.success || parsed.data.id) throw new HttpError(400, "validation_failed");
    const input = parsed.data;
    const databaseId = crypto.randomUUID();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    await mutate(env.DB.prepare(
      `INSERT INTO opportunities
        (id, user_id, slug, country, categories, image_path, apply_url, opens_at, deadline,
         featured, published, translations, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?13)`
    ).bind(
      databaseId,
      identity.id,
      input.slug,
      input.country,
      JSON.stringify(input.categories),
      input.imagePath,
      input.applyUrl,
      input.opensAt,
      input.deadline,
      input.featured ? 1 : 0,
      input.published ? 1 : 0,
      JSON.stringify(input.translations),
      now
    ));
    return json({
      success: true,
      resourceId: await createResourceRef(databaseId, "opportunity", identity.id, env.SESSION_SECRET)
    }, 201);
  }
  if (request.method === "PUT" && id) {
    const parsed = opportunitySchema.safeParse(await readJson(request, 65536));
    if (!parsed.success || parsed.data.id && parsed.data.id !== id) throw new HttpError(400, "validation_failed");
    const input = parsed.data;
    const databaseId = await resolveResourceRef(id, "opportunity", identity.id, env.SESSION_SECRET);
    await mutate(env.DB.prepare(
      `UPDATE opportunities SET slug = ?1, country = ?2, categories = ?3, image_path = ?4,
       apply_url = ?5, opens_at = ?6, deadline = ?7, featured = ?8, published = ?9,
       translations = ?10, updated_at = ?11 WHERE id = ?12 AND user_id = ?13`
    ).bind(
      input.slug,
      input.country,
      JSON.stringify(input.categories),
      input.imagePath,
      input.applyUrl,
      input.opensAt,
      input.deadline,
      input.featured ? 1 : 0,
      input.published ? 1 : 0,
      JSON.stringify(input.translations),
      (/* @__PURE__ */ new Date()).toISOString(),
      databaseId,
      identity.id
    ));
    return json({ success: true });
  }
  if (request.method === "DELETE" && id) {
    const databaseId = await resolveResourceRef(id, "opportunity", identity.id, env.SESSION_SECRET);
    await mutate(env.DB.prepare("DELETE FROM opportunities WHERE id = ?1 AND user_id = ?2").bind(databaseId, identity.id));
    return json({ success: true });
  }
  throw new HttpError(405, "method_not_allowed");
}
__name(opportunities, "opportunities");
async function adminRecords(env, identity, table) {
  if (table === "guide_download_leads") {
    const { results } = await env.DB.prepare(
      `SELECT id, name_ciphertext, email_ciphertext, phone_ciphertext, guide_slug, locale, created_at
       FROM guide_download_leads ORDER BY created_at DESC LIMIT 100`
    ).all();
    const items = await Promise.all(results.map(async (row) => ({
      id: await createResourceRef(row.id, "lead", identity.id, env.SESSION_SECRET),
      submittedAt: row.created_at,
      name: await decryptPii(row.name_ciphertext, env.PII_ENCRYPTION_KEY_V1),
      email: await decryptPii(row.email_ciphertext, env.PII_ENCRYPTION_KEY_V1),
      phone: row.phone_ciphertext ? await decryptPii(row.phone_ciphertext, env.PII_ENCRYPTION_KEY_V1) : null,
      guideSlug: row.guide_slug,
      locale: row.locale
    })));
    return json({ items });
  }
  if (table === "contact_messages") {
    const { results } = await env.DB.prepare(
      `SELECT id, name_ciphertext, email_ciphertext, message_ciphertext, locale, created_at
       FROM contact_submissions ORDER BY created_at DESC LIMIT 100`
    ).all();
    const items = await Promise.all(results.map(async (row) => ({
      id: await createResourceRef(row.id, "contact", identity.id, env.SESSION_SECRET),
      submittedAt: row.created_at,
      name: await decryptPii(row.name_ciphertext, env.PII_ENCRYPTION_KEY_V1),
      email: await decryptPii(row.email_ciphertext, env.PII_ENCRYPTION_KEY_V1),
      message: await decryptPii(row.message_ciphertext, env.PII_ENCRYPTION_KEY_V1),
      locale: row.locale
    })));
    return json({ items });
  }
  if (table === "newsletter_subscribers") {
    const { results } = await env.DB.prepare(
      `SELECT id, email_ciphertext, locale, created_at, unsubscribed_at
       FROM newsletter_subscribers ORDER BY created_at DESC LIMIT 100`
    ).all();
    const items = await Promise.all(results.map(async (row) => ({
      id: await createResourceRef(row.id, "newsletter", identity.id, env.SESSION_SECRET),
      email: await decryptPii(row.email_ciphertext, env.PII_ENCRYPTION_KEY_V1),
      locale: row.locale,
      subscribedAt: row.created_at,
      unsubscribedAt: row.unsubscribed_at
    })));
    return json({ items });
  }
  throw new HttpError(404, "not_found");
}
__name(adminRecords, "adminRecords");
async function metrics(env) {
  const [downloadRow, emailRow] = await Promise.all([
    env.DB.prepare("SELECT COUNT(*) AS total FROM guide_download_leads").first(),
    env.DB.prepare("SELECT COUNT(*) AS total FROM newsletter_subscribers WHERE unsubscribed_at IS NULL").first()
  ]);
  const downloads = downloadRow?.total ?? 0;
  const emails = emailRow?.total ?? 0;
  return json({ downloads, emails, prospectRatio: emails ? Math.round(downloads / emails * 100) : 0 });
}
__name(metrics, "metrics");
async function charts(env) {
  const since = new Date(Date.now() - 30 * 864e5).toISOString();
  const { results } = await env.DB.prepare(
    `SELECT guide_slug, created_at FROM guide_download_leads
     WHERE created_at >= ?1 ORDER BY created_at DESC LIMIT 500`
  ).bind(since).all();
  const counts = /* @__PURE__ */ new Map();
  const days = /* @__PURE__ */ new Map();
  for (const row of results) {
    counts.set(row.guide_slug, (counts.get(row.guide_slug) ?? 0) + 1);
    const day = row.created_at.slice(0, 10);
    days.set(day, (days.get(day) ?? 0) + 1);
  }
  const mostVisited = [...counts].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([label, value]) => ({ label, value }));
  const total = mostVisited.reduce((sum, item) => sum + item.value, 0) || 1;
  const visitShare = mostVisited.map((item) => ({ label: item.label, value: Math.round(item.value / total * 100) }));
  const history = Array.from({ length: 30 }, (_, index) => {
    const date = new Date(Date.now() - (29 - index) * 864e5).toISOString().slice(0, 10);
    return { date, value: days.get(date) ?? 0 };
  });
  return json({ mostVisited, visitShare, history });
}
__name(charts, "charts");
async function adminApi(request, env, identity) {
  const path = new URL(request.url).pathname.slice("/api/v1/admin/".length).split("/").filter(Boolean);
  if (path[0] === "guides" && path.length <= 2) return guides(request, env, identity, path[1]);
  if (path[0] === "opportunities" && path.length <= 2) return opportunities(request, env, identity, path[1]);
  if (path[0] === "records" && path.length === 2) {
    requireMethod(request, ["GET"]);
    return adminRecords(env, identity, path[1]);
  }
  if (path[0] === "metrics" && path.length === 1) {
    requireMethod(request, ["GET"]);
    return metrics(env);
  }
  if (path[0] === "charts" && path.length === 1) {
    requireMethod(request, ["GET"]);
    return charts(env);
  }
  throw new HttpError(404, "not_found");
}
__name(adminApi, "adminApi");

// worker/security/access.ts
var encoder4 = new TextEncoder();
var jwksCache = /* @__PURE__ */ new Map();
function parsePart(part) {
  try {
    return JSON.parse(new TextDecoder().decode(base64UrlDecode(part)));
  } catch {
    throw new HttpError(401, "unauthorized");
  }
}
__name(parsePart, "parsePart");
function teamDomain(value) {
  let url;
  try {
    url = new URL(value.startsWith("https://") ? value : `https://${value}`);
  } catch {
    throw new HttpError(500, "access_not_configured");
  }
  if (url.protocol !== "https:" || !url.hostname.endsWith(".cloudflareaccess.com")) {
    throw new HttpError(500, "access_not_configured");
  }
  return url.origin;
}
__name(teamDomain, "teamDomain");
async function verificationKey(domain, kid) {
  let cached = jwksCache.get(domain);
  if (!cached || cached.expiresAt <= Date.now()) {
    const response = await fetch(`${domain}/cdn-cgi/access/certs`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(5e3),
      cf: { cacheTtl: 300, cacheEverything: true }
    });
    if (!response.ok) throw new HttpError(503, "access_key_unavailable");
    const jwks = await response.json();
    const keys = /* @__PURE__ */ new Map();
    for (const jwk of jwks.keys ?? []) {
      if (!jwk.kid || jwk.kty !== "RSA") continue;
      keys.set(jwk.kid, await crypto.subtle.importKey(
        "jwk",
        jwk,
        { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
        false,
        ["verify"]
      ));
    }
    cached = { keys, expiresAt: Date.now() + 5 * 6e4 };
    jwksCache.set(domain, cached);
  }
  const key = cached.keys.get(kid);
  if (!key) throw new HttpError(401, "unauthorized");
  return key;
}
__name(verificationKey, "verificationKey");
async function verifyCloudflareAccess(request, env) {
  if (!env.CF_ACCESS_POLICY_AUD) throw new HttpError(500, "access_not_configured");
  const token = request.headers.get("Cf-Access-Jwt-Assertion");
  if (!token || token.length > 16384) throw new HttpError(401, "unauthorized");
  const parts = token.split(".");
  if (parts.length !== 3) throw new HttpError(401, "unauthorized");
  const [encodedHeader, encodedClaims, encodedSignature] = parts;
  const header = parsePart(encodedHeader);
  const claims = parsePart(encodedClaims);
  if (header.alg !== "RS256" || !header.kid) throw new HttpError(401, "unauthorized");
  const domain = teamDomain(env.CF_ACCESS_TEAM_DOMAIN);
  const audiences = Array.isArray(claims.aud) ? claims.aud : claims.aud ? [claims.aud] : [];
  const now = Math.floor(Date.now() / 1e3);
  if (claims.iss !== domain || !audiences.includes(env.CF_ACCESS_POLICY_AUD) || claims.type !== "app" || typeof claims.exp !== "number" || claims.exp <= now - 60 || typeof claims.nbf === "number" && claims.nbf > now + 60 || typeof claims.iat === "number" && claims.iat > now + 60) {
    throw new HttpError(401, "unauthorized");
  }
  const valid = await crypto.subtle.verify(
    { name: "RSASSA-PKCS1-v1_5" },
    await verificationKey(domain, header.kid),
    base64UrlDecode(encodedSignature),
    encoder4.encode(`${encodedHeader}.${encodedClaims}`)
  );
  if (!valid) throw new HttpError(401, "unauthorized");
  return claims;
}
__name(verifyCloudflareAccess, "verifyCloudflareAccess");

// worker/validation/public.ts
var locale = external_exports.string().trim().pipe(external_exports.enum(["en", "fr", "ar"]));
var email = external_exports.string().trim().email().max(254).transform((value) => value.toLowerCase());
var turnstileToken = external_exports.string().trim().min(1).max(2048);
var contactInputSchema = external_exports.object({
  name: external_exports.string().trim().min(2).max(70),
  email,
  message: external_exports.string().trim().min(10).max(2e3),
  locale,
  turnstileToken
}).strict();
var leadInputSchema = external_exports.object({
  name: external_exports.string().trim().min(2).max(70),
  email,
  phone: external_exports.string().trim().min(7).max(20).regex(/^\+?[0-9 ()-]{7,20}$/),
  targetGuideId: external_exports.string().trim().min(1).max(64).regex(/^[A-Za-z0-9_-]+$/),
  locale,
  turnstileToken
}).strict();
var newsletterInputSchema = external_exports.object({
  email,
  locale,
  turnstileToken
}).strict();
var downloadGrantInputSchema = external_exports.object({
  grantToken: external_exports.string().trim().min(32).max(256).regex(/^[A-Za-z0-9_-]+$/),
  guideSlug: external_exports.string().trim().min(1).max(120).regex(/^[a-z0-9-]+$/)
}).strict();
var unsubscribeInputSchema = external_exports.object({
  token: external_exports.string().trim().min(32).max(256).regex(/^[A-Za-z0-9_-]+$/)
}).strict();

// worker/routes/download-grant.ts
function safeObjectKey(value) {
  return value.length <= 512 && /^[a-z0-9][a-z0-9._/-]*\.pdf$/.test(value) && !value.includes("..") && !value.startsWith("/") && !value.includes("//");
}
__name(safeObjectKey, "safeObjectKey");
async function downloadGrant(request, env) {
  requireMethod(request, ["POST"]);
  const parsed = downloadGrantInputSchema.safeParse(await readJson(request, 2048));
  if (!parsed.success) throw new HttpError(400, "validation_failed");
  const now = Math.floor(Date.now() / 1e3);
  const tokenHash = await sha256(parsed.data.grantToken);
  const grant = await env.DB.prepare(
    `SELECT id, object_key FROM download_grants
     WHERE token = ?1 AND guide_slug = ?2 AND expires_at > ?3 AND consumed = 0
     LIMIT 1`
  ).bind(tokenHash, parsed.data.guideSlug, now).first();
  if (!grant || !safeObjectKey(grant.object_key)) throw new HttpError(404, "not_found");
  const object = await env.GUIDES_BUCKET.get(grant.object_key);
  if (!object) throw new HttpError(404, "not_found");
  const consumed = await env.DB.prepare(
    `UPDATE download_grants SET consumed = 1, consumed_at = ?1
     WHERE id = ?2 AND token = ?3 AND expires_at > ?4 AND consumed = 0
     RETURNING id`
  ).bind((/* @__PURE__ */ new Date()).toISOString(), grant.id, tokenHash, now).first();
  if (!consumed) throw new HttpError(404, "not_found");
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("Content-Type", "application/pdf");
  headers.set("Content-Disposition", `attachment; filename="${parsed.data.guideSlug}.pdf"`);
  headers.set("Content-Length", String(object.size));
  headers.set("ETag", object.httpEtag);
  headers.set("Cache-Control", "private, no-store, max-age=0");
  return new Response(object.body, { status: 200, headers });
}
__name(downloadGrant, "downloadGrant");

// worker/security/upload-defense.ts
var MAX_API_BODY_BYTES = 10 * 1024 * 1024;
var UPLOAD_MEDIA_TYPES = /* @__PURE__ */ new Set([
  "application/octet-stream",
  "application/pdf",
  "application/zip",
  "application/x-7z-compressed",
  "application/x-msdownload",
  "image/svg+xml",
  "text/html"
]);
function enforceUploadBoundary(request) {
  const declaredLength = request.headers.get("Content-Length");
  if (declaredLength) {
    const bytes = Number(declaredLength);
    if (!Number.isSafeInteger(bytes) || bytes < 0) throw new HttpError(400, "invalid_content_length");
    if (bytes > MAX_API_BODY_BYTES) throw new HttpError(413, "payload_too_large");
  }
  const encoding = request.headers.get("Content-Encoding")?.trim().toLowerCase();
  if (encoding && encoding !== "identity") throw new HttpError(415, "unsupported_content_encoding");
  const contentType = request.headers.get("Content-Type")?.split(";", 1)[0].trim().toLowerCase();
  const uploadShaped = contentType?.startsWith("multipart/") || (contentType ? UPLOAD_MEDIA_TYPES.has(contentType) : false) || request.headers.has("Content-Disposition");
  if (uploadShaped) throw new HttpError(415, "runtime_uploads_disabled");
}
__name(enforceUploadBoundary, "enforceUploadBoundary");

// worker/security/rate-limit.ts
function resolveRateLimitPolicy(request) {
  if (request.method === "OPTIONS") return null;
  const pathname = new URL(request.url).pathname;
  if (request.method === "POST" && pathname === "/api/v1/contact") return { name: "contact", limit: 5, windowSeconds: 600 };
  if (request.method === "POST" && pathname === "/api/v1/leads") return { name: "leads", limit: 5, windowSeconds: 600 };
  if (request.method === "POST" && pathname === "/api/v1/newsletter") return { name: "newsletter", limit: 3, windowSeconds: 600 };
  if (request.method === "POST" && pathname === "/api/v1/auth/sign-in") return { name: "admin-sign-in", limit: 5, windowSeconds: 600 };
  if (pathname.startsWith("/api/v1/admin/")) return { name: "admin", limit: 10, windowSeconds: 60 };
  return null;
}
__name(resolveRateLimitPolicy, "resolveRateLimitPolicy");
async function checkRateLimit(request, now = Date.now()) {
  const policy = resolveRateLimitPolicy(request);
  if (!policy) return null;
  const ip = request.headers.get("CF-Connecting-IP")?.trim() || "unknown";
  const actor = await sha256(ip);
  const key = new Request(`https://rate-limit.invalid/${policy.name}/${actor}`);
  const edgeCache = caches.default;
  try {
    const cached = await edgeCache.match(key);
    const previous = cached ? await cached.json() : [];
    const cutoff = now - policy.windowSeconds * 1e3;
    const timestamps = Array.isArray(previous) ? previous.filter((value) => Number.isSafeInteger(value) && value > cutoff && value <= now) : [];
    if (timestamps.length >= policy.limit) {
      return {
        ...policy,
        allowed: false,
        remaining: 0,
        retryAfter: Math.max(1, Math.ceil((timestamps[0] + policy.windowSeconds * 1e3 - now) / 1e3))
      };
    }
    timestamps.push(now);
    await edgeCache.put(key, new Response(JSON.stringify(timestamps), {
      headers: {
        "Cache-Control": `max-age=${policy.windowSeconds}`,
        "Content-Type": "application/json"
      }
    }));
    return {
      ...policy,
      allowed: true,
      remaining: policy.limit - timestamps.length,
      retryAfter: 0
    };
  } catch {
    throw new HttpError(503, "rate_limiter_unavailable");
  }
}
__name(checkRateLimit, "checkRateLimit");
function rateLimitHeaders(result) {
  const headers = new Headers({
    "RateLimit-Limit": String(result.limit),
    "RateLimit-Remaining": String(result.remaining)
  });
  if (!result.allowed) headers.set("Retry-After", String(result.retryAfter));
  return headers;
}
__name(rateLimitHeaders, "rateLimitHeaders");
function rateLimitResponse(result, requestId) {
  return json({ error: "Too many requests", requestId }, 429, rateLimitHeaders(result));
}
__name(rateLimitResponse, "rateLimitResponse");
function attachRateLimitHeaders(response, result) {
  if (!result) return response;
  const hardened = new Response(response.body, response);
  rateLimitHeaders(result).forEach((value, key) => hardened.headers.set(key, value));
  return hardened;
}
__name(attachRateLimitHeaders, "attachRateLimitHeaders");

// worker/security/request-guard.ts
var PUBLIC_BODY_LIMIT = 64 * 1024;
var ADMIN_BODY_LIMIT = 512 * 1024;
var MUTATING_METHODS = /* @__PURE__ */ new Set(["POST", "PUT", "PATCH", "DELETE"]);
function enforceRequestEnvelope(request) {
  if (!MUTATING_METHODS.has(request.method)) return;
  const pathname = new URL(request.url).pathname;
  const maxBytes = pathname.startsWith("/api/v1/admin/") ? ADMIN_BODY_LIMIT : PUBLIC_BODY_LIMIT;
  const declared = request.headers.get("Content-Length");
  if (declared) {
    const bytes = Number(declared);
    if (!Number.isSafeInteger(bytes) || bytes < 0) throw new HttpError(400, "invalid_content_length");
    if (bytes > maxBytes) throw new HttpError(413, "payload_too_large");
  }
  const rawContentType = request.headers.get("Content-Type")?.trim().toLowerCase() ?? "";
  const contentTypeParts = rawContentType.split(";").map((part) => part.trim());
  const validCharset = contentTypeParts.length === 1 || contentTypeParts.length === 2 && contentTypeParts[1] === "charset=utf-8";
  if (rawContentType.length > 128 || rawContentType.includes(",") || contentTypeParts[0] !== "application/json" || !validCharset) {
    throw new HttpError(415, "unsupported_media_type");
  }
}
__name(enforceRequestEnvelope, "enforceRequestEnvelope");

// worker/security/headers.ts
var CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' https://challenges.cloudflare.com https://plausible.io",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "img-src 'self' data: blob:",
  "connect-src 'self' https://challenges.cloudflare.com https://plausible.io",
  "frame-src https://challenges.cloudflare.com",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://wa.me https://api.whatsapp.com",
  "manifest-src 'self'",
  "upgrade-insecure-requests"
].join("; ");
var SECURITY_HEADERS = {
  "Content-Security-Policy": CONTENT_SECURITY_POLICY,
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  "X-XSS-Protection": "0"
};
function applySecurityHeaders(response) {
  const hardened = new Response(response.body, response);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) hardened.headers.set(name, value);
  return hardened;
}
__name(applySecurityHeaders, "applySecurityHeaders");
function httpsRedirect(request) {
  const url = new URL(request.url);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.protocol !== "http:" || local) return null;
  url.protocol = "https:";
  return Response.redirect(url.toString(), 308);
}
__name(httpsRedirect, "httpsRedirect");

// worker/security/origin.ts
var ALLOWED_METHODS = /* @__PURE__ */ new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]);
var ALLOWED_REQUEST_HEADERS = /* @__PURE__ */ new Set(["content-type", "idempotency-key"]);
function configuredOrigins(request, env) {
  const origins = /* @__PURE__ */ new Set();
  for (const value of (env.ALLOWED_ORIGINS ?? "").split(",")) {
    const candidate = value.trim();
    if (!candidate || candidate.includes("*")) continue;
    try {
      const url = new URL(candidate);
      const localHttp = url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
      const originOnly = url.pathname === "/" && !url.search && !url.hash && !url.username && !url.password;
      if ((url.protocol === "https:" || localHttp) && originOnly) origins.add(url.origin);
    } catch {
    }
  }
  const requestUrl = new URL(request.url);
  if (["localhost", "127.0.0.1", "[::1]"].includes(requestUrl.hostname)) origins.add(requestUrl.origin);
  return origins;
}
__name(configuredOrigins, "configuredOrigins");
function headerOrigin(value) {
  if (!value || value.length > 2048 || value === "null") return null;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.origin : null;
  } catch {
    return null;
  }
}
__name(headerOrigin, "headerOrigin");
function verifyApiOrigin(request, env) {
  const allowed = configuredOrigins(request, env);
  if (allowed.size === 0) throw new HttpError(503, "origin_policy_not_configured");
  const rawOrigin = request.headers.get("Origin");
  const rawReferer = request.headers.get("Referer");
  const origin = headerOrigin(rawOrigin);
  const referer = headerOrigin(rawReferer);
  if (rawOrigin && !origin || rawReferer && !referer) throw new HttpError(403, "origin_denied");
  if (!origin && !referer) throw new HttpError(403, "origin_denied");
  if (origin && !allowed.has(origin) || referer && !allowed.has(referer)) {
    throw new HttpError(403, "origin_denied");
  }
  return { origin: origin ?? referer };
}
__name(verifyApiOrigin, "verifyApiOrigin");
function applyCorsHeaders(response, context) {
  if (!context) return response;
  const corsResponse = new Response(response.body, response);
  corsResponse.headers.set("Access-Control-Allow-Origin", context.origin);
  corsResponse.headers.set("Access-Control-Allow-Credentials", "true");
  const vary = corsResponse.headers.get("Vary");
  corsResponse.headers.set("Vary", vary ? `${vary}, Origin` : "Origin");
  return corsResponse;
}
__name(applyCorsHeaders, "applyCorsHeaders");
function preflightResponse(request, context) {
  const requestedMethod = request.headers.get("Access-Control-Request-Method")?.trim().toUpperCase() ?? "";
  if (requestedMethod.length > 10 || !ALLOWED_METHODS.has(requestedMethod)) {
    throw new HttpError(405, "method_not_allowed");
  }
  const requestedHeaders = (request.headers.get("Access-Control-Request-Headers") ?? "").split(",").map((header) => header.trim().toLowerCase()).filter(Boolean);
  if (requestedHeaders.some((header) => header.length > 64 || !ALLOWED_REQUEST_HEADERS.has(header))) {
    throw new HttpError(403, "cors_headers_denied");
  }
  return applyCorsHeaders(new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Methods": requestedMethod,
      "Access-Control-Allow-Headers": [...ALLOWED_REQUEST_HEADERS].join(", "),
      "Access-Control-Max-Age": "600",
      "Cache-Control": "no-store"
    }
  }), context);
}
__name(preflightResponse, "preflightResponse");

// worker/security/env-validator.ts
var validatedEnvironments = /* @__PURE__ */ new WeakSet();
var LOCAL_HOSTS = /* @__PURE__ */ new Set(["localhost", "127.0.0.1", "[::1]"]);
function invalid() {
  throw new HttpError(500, "runtime_not_configured");
}
__name(invalid, "invalid");
function required(value, minLength = 1, maxLength = 4096) {
  const normalized = value?.trim() ?? "";
  if (normalized.length < minLength || normalized.length > maxLength || /\s/.test(normalized) || /^(?:change-?me|placeholder|undefined|null)$/i.test(normalized)) invalid();
  return normalized;
}
__name(required, "required");
function hasMinimumEntropy(bytes) {
  const counts = /* @__PURE__ */ new Map();
  for (const byte of bytes) counts.set(byte, (counts.get(byte) ?? 0) + 1);
  const entropy = [...counts.values()].reduce((total, count) => {
    const probability = count / bytes.length;
    return total - probability * Math.log2(probability);
  }, 0);
  return counts.size >= 12 && entropy >= 3.5;
}
__name(hasMinimumEntropy, "hasMinimumEntropy");
function secret(value) {
  try {
    if (!hasMinimumEntropy(decodeSecretKey(required(value, 43, 64)))) invalid();
  } catch {
    invalid();
  }
}
__name(secret, "secret");
function secureUrl(value, allowedLocal = false) {
  let url;
  try {
    url = new URL(required(value, 8, 2048));
  } catch {
    invalid();
  }
  const localHttp = allowedLocal && url.protocol === "http:" && LOCAL_HOSTS.has(url.hostname);
  if (url.protocol !== "https:" && !localHttp || url.username || url.password) invalid();
  return url;
}
__name(secureUrl, "secureUrl");
function assertRuntimeEnv(env) {
  if (validatedEnvironments.has(env)) return;
  secret(env.PII_ENCRYPTION_KEY_V1);
  secret(env.BLIND_INDEX_SECRET);
  secret(env.SESSION_SECRET);
  secret(env.WEBHOOK_HMAC_SECRET);
  required(env.TURNSTILE_SECRET_KEY, 16, 512);
  required(env.CF_ACCESS_POLICY_AUD, 16, 256);
  const access = secureUrl(env.CF_ACCESS_TEAM_DOMAIN);
  if (!access.hostname.endsWith(".cloudflareaccess.com") || access.pathname !== "/") invalid();
  const allowedHosts = required(env.TURNSTILE_ALLOWED_HOSTNAMES, 1, 2048).split(",");
  if (allowedHosts.some((host) => !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$|^(?:localhost|127\.0\.0\.1|\[::1\])$/i.test(host.trim()))) invalid();
  const origins = required(env.ALLOWED_ORIGINS, 8, 4096).split(",").map((origin) => secureUrl(origin.trim(), true));
  if (origins.some((origin) => origin.origin !== origin.href.replace(/\/$/, ""))) invalid();
  const webhook = secureUrl(env.OUTBOUND_WEBHOOK_URL);
  if (webhook.port || webhook.pathname === "/" || webhook.search || webhook.hash) invalid();
  const webhookHosts = new Set(required(env.OUTBOUND_WEBHOOK_ALLOWED_HOSTS, 1, 2048).split(",").map((host) => host.trim().toLowerCase()));
  if (!webhookHosts.has(webhook.hostname.toLowerCase())) invalid();
  if (typeof env.ASSETS?.fetch !== "function" || typeof env.EVENT_QUEUE?.send !== "function" || typeof env.DB?.prepare !== "function" || typeof env.GUIDES_BUCKET?.get !== "function") invalid();
  validatedEnvironments.add(env);
}
__name(assertRuntimeEnv, "assertRuntimeEnv");

// worker/queue/outbox-consumer.ts
var encoder5 = new TextEncoder();
var WEBHOOK_TOLERANCE_SECONDS = 5 * 60;
var DeliveryError = class extends Error {
  constructor(message, attempts) {
    super(message);
    this.attempts = attempts;
  }
  attempts;
  static {
    __name(this, "DeliveryError");
  }
};
function validUuid(value) {
  return Boolean(value?.length === 36 && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value));
}
__name(validUuid, "validUuid");
function toHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
__name(toHex, "toHex");
async function importWebhookKey(secret2, usages) {
  const bytes = decodeSecretKey(secret2);
  return crypto.subtle.importKey("raw", bytes, { name: "HMAC", hash: "SHA-256" }, false, usages);
}
__name(importWebhookKey, "importWebhookKey");
async function signWebhookPayload(body, timestamp, secret2) {
  const signature = await crypto.subtle.sign(
    "HMAC",
    await importWebhookKey(secret2, ["sign"]),
    encoder5.encode(`${timestamp}.${body}`)
  );
  return toHex(new Uint8Array(signature));
}
__name(signWebhookPayload, "signWebhookPayload");
async function eventPayload(env, event) {
  if (event.event_type === "guide_lead.created") {
    const row = await env.DB.prepare(
      `SELECT id, name_ciphertext, email_ciphertext, phone_ciphertext, guide_slug, locale, created_at
       FROM guide_download_leads WHERE id = ?1 LIMIT 1`
    ).bind(event.aggregate_id).first();
    if (!row) throw new Error("outbox_record_missing");
    return {
      id: row.id,
      name: await decryptPii(row.name_ciphertext, env.PII_ENCRYPTION_KEY_V1),
      email: await decryptPii(row.email_ciphertext, env.PII_ENCRYPTION_KEY_V1),
      phone: row.phone_ciphertext ? await decryptPii(row.phone_ciphertext, env.PII_ENCRYPTION_KEY_V1) : null,
      guideSlug: row.guide_slug,
      locale: row.locale,
      createdAt: row.created_at
    };
  }
  if (event.event_type === "contact.created") {
    const row = await env.DB.prepare(
      `SELECT id, name_ciphertext, email_ciphertext, message_ciphertext, locale, created_at
       FROM contact_submissions WHERE id = ?1 LIMIT 1`
    ).bind(event.aggregate_id).first();
    if (!row) throw new Error("outbox_record_missing");
    return {
      id: row.id,
      name: await decryptPii(row.name_ciphertext, env.PII_ENCRYPTION_KEY_V1),
      email: await decryptPii(row.email_ciphertext, env.PII_ENCRYPTION_KEY_V1),
      message: await decryptPii(row.message_ciphertext, env.PII_ENCRYPTION_KEY_V1),
      locale: row.locale,
      createdAt: row.created_at
    };
  }
  if (event.event_type === "newsletter.subscribed") {
    const row = await env.DB.prepare(
      `SELECT id, email_ciphertext, locale, created_at
       FROM newsletter_subscribers WHERE id = ?1 LIMIT 1`
    ).bind(event.aggregate_id).first();
    if (!row) throw new Error("outbox_record_missing");
    return {
      id: row.id,
      email: await decryptPii(row.email_ciphertext, env.PII_ENCRYPTION_KEY_V1),
      locale: row.locale,
      consentedAt: row.created_at
    };
  }
  throw new Error("unsupported_outbox_event");
}
__name(eventPayload, "eventPayload");
function webhookUrl(env) {
  const url = new URL(env.OUTBOUND_WEBHOOK_URL);
  const allowed = new Set(env.OUTBOUND_WEBHOOK_ALLOWED_HOSTS.split(",").map((host) => host.trim().toLowerCase()).filter(Boolean));
  if (url.protocol !== "https:" || url.username || url.password || url.port || !allowed.has(url.hostname.toLowerCase())) {
    throw new Error("webhook_destination_denied");
  }
  return url;
}
__name(webhookUrl, "webhookUrl");
function retryDelaySeconds(attempts) {
  return Math.min(300, 5 * 2 ** Math.max(0, attempts - 1));
}
__name(retryDelaySeconds, "retryDelaySeconds");
async function claimEvent(env, outboxId) {
  const now = Math.floor(Date.now() / 1e3);
  return env.DB.prepare(
    `UPDATE outbox_events SET
       status = 'processing', attempts = attempts + 1, locked_at = ?1, updated_at = ?2
     WHERE id = ?3 AND status IN ('pending', 'failed') AND available_at <= ?1 AND attempts < 100
     RETURNING id, event_type, aggregate_id, attempts`
  ).bind(now, new Date(now * 1e3).toISOString(), outboxId).first();
}
__name(claimEvent, "claimEvent");
async function relay(env, outboxId) {
  const event = await claimEvent(env, outboxId);
  if (!event) return;
  try {
    const body = JSON.stringify({ id: event.id, type: event.event_type, data: await eventPayload(env, event) });
    const timestamp = Math.floor(Date.now() / 1e3).toString();
    const signature = await signWebhookPayload(body, timestamp, env.WEBHOOK_HMAC_SECRET);
    const response = await fetch(webhookUrl(env), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-A-Step-Event-Id": event.id,
        "X-Astep-Signature": `t=${timestamp},v1=${signature}`
      },
      body,
      signal: AbortSignal.timeout(5e3)
    });
    if (!response.ok) throw new Error(`webhook_http_${response.status}`);
    const completedAt = (/* @__PURE__ */ new Date()).toISOString();
    await env.DB.prepare(
      `UPDATE outbox_events SET status = 'delivered', delivered_at = ?1, locked_at = NULL,
       last_error = NULL, updated_at = ?1 WHERE id = ?2 AND status = 'processing'`
    ).bind(completedAt, event.id).run();
  } catch (error) {
    const message = (error instanceof Error ? error.message : "webhook_failed").slice(0, 500);
    const now = Math.floor(Date.now() / 1e3);
    await env.DB.prepare(
      `UPDATE outbox_events SET status = 'failed', available_at = ?1, locked_at = NULL,
       last_error = ?2, updated_at = ?3 WHERE id = ?4 AND status = 'processing'`
    ).bind(now + retryDelaySeconds(event.attempts), message, new Date(now * 1e3).toISOString(), event.id).run();
    throw new DeliveryError(message, event.attempts);
  }
}
__name(relay, "relay");
async function drainOutbox(env) {
  const now = Math.floor(Date.now() / 1e3);
  await env.DB.batch([
    env.DB.prepare("DELETE FROM idempotency_keys WHERE expires_at <= ?1").bind(now),
    env.DB.prepare(
      `UPDATE outbox_events SET status = 'failed', locked_at = NULL, available_at = ?1, updated_at = ?2
       WHERE status = 'processing' AND locked_at < ?3`
    ).bind(now, new Date(now * 1e3).toISOString(), now - 600)
  ]);
  const { results } = await env.DB.prepare(
    `SELECT id FROM outbox_events
     WHERE status IN ('pending', 'failed') AND available_at <= ?1 AND attempts < 100
     ORDER BY created_at ASC LIMIT 50`
  ).bind(now).all();
  await Promise.all(results.map((event) => env.EVENT_QUEUE.send({ outboxId: event.id })));
}
__name(drainOutbox, "drainOutbox");
async function consumeOutbox(batch, env) {
  await Promise.all(batch.messages.map(async (message) => {
    const id = message.body?.outboxId;
    if (!validUuid(id)) {
      message.ack();
      return;
    }
    try {
      await relay(env, id);
      message.ack();
    } catch (error) {
      const attempts = error instanceof DeliveryError ? error.attempts : 1;
      message.retry({ delaySeconds: retryDelaySeconds(attempts) });
    }
  }));
}
__name(consumeOutbox, "consumeOutbox");

// worker/security/blind-index.ts
var encoder6 = new TextEncoder();
function toHex2(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
__name(toHex2, "toHex");
async function importBlindIndexKey(secret2) {
  const bytes = decodeSecretKey(secret2);
  return crypto.subtle.importKey("raw", bytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
}
__name(importBlindIndexKey, "importBlindIndexKey");
function normalizeBlindIndexValue(value) {
  return value.normalize("NFKC").trim().toLowerCase();
}
__name(normalizeBlindIndexValue, "normalizeBlindIndexValue");
async function createBlindIndex(value, secret2, namespace = "email") {
  const normalized = normalizeBlindIndexValue(value);
  const signature = await crypto.subtle.sign(
    "HMAC",
    await importBlindIndexKey(secret2),
    encoder6.encode(`${namespace}\0${normalized}`)
  );
  return toHex2(new Uint8Array(signature));
}
__name(createBlindIndex, "createBlindIndex");

// worker/security/turnstile.ts
var SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
var TOKEN_MAX_AGE_MS = 3e5;
function allowedHostnames(request, env) {
  const configured = (env.TURNSTILE_ALLOWED_HOSTNAMES ?? "").split(",").map((hostname) => hostname.trim().toLowerCase()).filter(Boolean);
  const requestHostname = new URL(request.url).hostname.toLowerCase();
  if (requestHostname === "localhost" || requestHostname === "127.0.0.1" || requestHostname === "[::1]") {
    configured.push("localhost", "127.0.0.1", "[::1]");
  }
  return new Set(configured);
}
__name(allowedHostnames, "allowedHostnames");
async function verifyTurnstile(request, env, token, expectedAction, now = Date.now()) {
  if (!env.TURNSTILE_SECRET_KEY) throw new HttpError(503, "challenge_not_configured");
  if (!token || token.length > 2048) throw new HttpError(400, "challenge_required");
  const form = new FormData();
  form.set("secret", env.TURNSTILE_SECRET_KEY);
  form.set("response", token);
  form.set("idempotency_key", crypto.randomUUID());
  const remoteIp = request.headers.get("CF-Connecting-IP");
  if (remoteIp) form.set("remoteip", remoteIp);
  let result;
  try {
    const response = await fetch(SITEVERIFY_URL, {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(5e3)
    });
    if (!response.ok) throw new Error("siteverify_failed");
    result = await response.json();
  } catch {
    throw new HttpError(403, "challenge_failed");
  }
  const challengeTime = Date.parse(result.challenge_ts ?? "");
  const age = now - challengeTime;
  const hosts = allowedHostnames(request, env);
  if (result.success !== true || hosts.size === 0 || !result.hostname || !hosts.has(result.hostname.toLowerCase()) || result.action !== expectedAction || !Number.isFinite(challengeTime) || age < -3e4 || age >= TOKEN_MAX_AGE_MS) {
    throw new HttpError(403, "challenge_failed");
  }
  const nowSeconds = Math.floor(now / 1e3);
  const replayKey = `turnstile:${await sha256(token)}`;
  try {
    await env.DB.prepare("DELETE FROM idempotency_keys WHERE key = ?1 AND expires_at <= ?2").bind(replayKey, nowSeconds).run();
    await env.DB.prepare(
      "INSERT INTO idempotency_keys (key, action, created_at, expires_at) VALUES (?1, ?2, ?3, ?4)"
    ).bind(replayKey, `turnstile:${expectedAction}`, new Date(now).toISOString(), nowSeconds + 300).run();
  } catch {
    const replayed = await env.DB.prepare(
      "SELECT 1 AS present FROM idempotency_keys WHERE key = ?1 AND expires_at > ?2 LIMIT 1"
    ).bind(replayKey, nowSeconds).first();
    if (replayed) throw new HttpError(403, "challenge_replayed");
    throw new HttpError(503, "challenge_store_unavailable");
  }
}
__name(verifyTurnstile, "verifyTurnstile");

// worker/public-api.ts
var IDEMPOTENCY_TTL_SECONDS = 24 * 60 * 60;
var GRANT_TTL_SECONDS = 5 * 60;
async function pii(value, env) {
  return value ? encryptPii(value, env.PII_ENCRYPTION_KEY_V1) : null;
}
__name(pii, "pii");
function enqueue(ctx, env, eventId) {
  ctx.waitUntil(env.EVENT_QUEUE.send({ outboxId: eventId }));
}
__name(enqueue, "enqueue");
async function storedResponse(env, key, action, now) {
  const row = await env.DB.prepare(
    "SELECT response FROM idempotency_keys WHERE key = ?1 AND action = ?2 AND expires_at > ?3"
  ).bind(key, action, now).first();
  if (!row?.response) return null;
  try {
    return JSON.parse(row.response);
  } catch {
    throw new HttpError(503, "service_unavailable");
  }
}
__name(storedResponse, "storedResponse");
async function idempotentBatch(env, idempotencyKey, action, response, statements, now) {
  const key = `${action}:${idempotencyKey}`;
  const existing = await storedResponse(env, key, action, now);
  if (existing) return { value: existing, created: false };
  const createdAt = new Date(now * 1e3).toISOString();
  try {
    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO idempotency_keys (key, action, response, created_at, expires_at) VALUES (?1, ?2, ?3, ?4, ?5)"
      ).bind(key, action, JSON.stringify(response), createdAt, now + IDEMPOTENCY_TTL_SECONDS),
      ...statements
    ]);
    return { value: response, created: true };
  } catch {
    const raced = await storedResponse(env, key, action, now);
    if (raced) return { value: raced, created: false };
    throw new HttpError(503, "service_unavailable");
  }
}
__name(idempotentBatch, "idempotentBatch");
async function createGuideLead(request, env, ctx) {
  requireMethod(request, ["POST"]);
  const idempotencyKey = requireIdempotencyKey(request);
  const parsed = leadInputSchema.safeParse(await readJson(request, 4096));
  if (!parsed.success) throw new HttpError(400, "validation_failed");
  const input = parsed.data;
  await verifyTurnstile(request, env, input.turnstileToken, "lead_download");
  const asset = await env.DB.prepare(
    "SELECT slug, object_key FROM guide_assets WHERE id = ?1 LIMIT 1"
  ).bind(input.targetGuideId).first();
  if (!asset) throw new HttpError(404, "guide_not_found");
  const now = Math.floor(Date.now() / 1e3);
  const createdAt = new Date(now * 1e3).toISOString();
  const leadId = crypto.randomUUID();
  const grantId = crypto.randomUUID();
  const eventId = crypto.randomUUID();
  const grantToken = randomToken();
  const response = { success: true, grantToken };
  const result = await idempotentBatch(env, idempotencyKey, "guide_lead", response, [
    env.DB.prepare(
      `INSERT INTO guide_download_leads
        (id, name_ciphertext, email_ciphertext, email_blind_index, phone_ciphertext, guide_slug, locale, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`
    ).bind(
      leadId,
      await pii(input.name, env),
      await pii(input.email, env),
      await createBlindIndex(input.email, env.BLIND_INDEX_SECRET),
      await pii(input.phone, env),
      asset.slug,
      input.locale,
      createdAt
    ),
    env.DB.prepare(
      `INSERT INTO download_grants
        (id, lead_id, token, guide_slug, object_key, expires_at, consumed)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, 0)`
    ).bind(grantId, leadId, await sha256(grantToken), asset.slug, asset.object_key, now + GRANT_TTL_SECONDS),
    env.DB.prepare(
      `INSERT INTO outbox_events
        (id, event_type, aggregate_id, status, attempts, available_at, created_at, updated_at)
       VALUES (?1, 'guide_lead.created', ?2, 'pending', 0, ?3, ?4, ?4)`
    ).bind(eventId, leadId, now, createdAt)
  ], now);
  if (result.created) enqueue(ctx, env, eventId);
  return json(result.value, 201);
}
__name(createGuideLead, "createGuideLead");
async function createContact(request, env, ctx) {
  requireMethod(request, ["POST"]);
  const idempotencyKey = requireIdempotencyKey(request);
  const parsed = contactInputSchema.safeParse(await readJson(request, 8192));
  if (!parsed.success) throw new HttpError(400, "validation_failed");
  const input = parsed.data;
  await verifyTurnstile(request, env, input.turnstileToken, "contact");
  const now = Math.floor(Date.now() / 1e3);
  const createdAt = new Date(now * 1e3).toISOString();
  const contactId = crypto.randomUUID();
  const eventId = crypto.randomUUID();
  const response = { success: true };
  const result = await idempotentBatch(env, idempotencyKey, "contact", response, [
    env.DB.prepare(
      `INSERT INTO contact_submissions
        (id, name_ciphertext, email_ciphertext, email_blind_index, message_ciphertext, locale, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`
    ).bind(
      contactId,
      await pii(input.name, env),
      await pii(input.email, env),
      await createBlindIndex(input.email, env.BLIND_INDEX_SECRET),
      await pii(input.message, env),
      input.locale,
      createdAt
    ),
    env.DB.prepare(
      `INSERT INTO outbox_events
        (id, event_type, aggregate_id, status, attempts, available_at, created_at, updated_at)
       VALUES (?1, 'contact.created', ?2, 'pending', 0, ?3, ?4, ?4)`
    ).bind(eventId, contactId, now, createdAt)
  ], now);
  if (result.created) enqueue(ctx, env, eventId);
  return json(result.value, 202);
}
__name(createContact, "createContact");
async function createNewsletterSubscription(request, env, ctx) {
  requireMethod(request, ["POST"]);
  const idempotencyKey = requireIdempotencyKey(request);
  const parsed = newsletterInputSchema.safeParse(await readJson(request, 4096));
  if (!parsed.success) throw new HttpError(400, "validation_failed");
  const input = parsed.data;
  await verifyTurnstile(request, env, input.turnstileToken, "newsletter");
  const now = Math.floor(Date.now() / 1e3);
  const createdAt = new Date(now * 1e3).toISOString();
  const blindIndex = await createBlindIndex(input.email, env.BLIND_INDEX_SECRET);
  const existing = await env.DB.prepare(
    "SELECT id FROM newsletter_subscribers WHERE email_blind_index = ?1 LIMIT 1"
  ).bind(blindIndex).first();
  const subscriberId = existing?.id ?? crypto.randomUUID();
  const eventId = crypto.randomUUID();
  const unsubscribeToken = randomToken();
  const response = { success: true };
  const result = await idempotentBatch(env, idempotencyKey, "newsletter", response, [
    env.DB.prepare(
      `INSERT INTO newsletter_subscribers
        (id, email_ciphertext, email_blind_index, locale, unsubscribe_token, unsubscribed_at, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, NULL, ?6)
       ON CONFLICT(email_blind_index) DO UPDATE SET
         email_ciphertext = excluded.email_ciphertext,
         locale = excluded.locale,
         unsubscribe_token = excluded.unsubscribe_token,
         unsubscribed_at = NULL`
    ).bind(
      subscriberId,
      await pii(input.email, env),
      blindIndex,
      input.locale,
      await sha256(unsubscribeToken),
      createdAt
    ),
    env.DB.prepare(
      `INSERT INTO outbox_events
        (id, event_type, aggregate_id, status, attempts, available_at, created_at, updated_at)
       VALUES (?1, 'newsletter.subscribed', ?2, 'pending', 0, ?3, ?4, ?4)`
    ).bind(eventId, subscriberId, now, createdAt)
  ], now);
  if (result.created) enqueue(ctx, env, eventId);
  return json(result.value, 202);
}
__name(createNewsletterSubscription, "createNewsletterSubscription");
async function unsubscribeNewsletter(request, env) {
  requireMethod(request, ["POST"]);
  const idempotencyKey = requireIdempotencyKey(request);
  const parsed = unsubscribeInputSchema.safeParse(await readJson(request, 2048));
  if (!parsed.success) throw new HttpError(400, "validation_failed");
  const now = Math.floor(Date.now() / 1e3);
  const response = { success: true };
  const result = await idempotentBatch(env, idempotencyKey, "newsletter_unsubscribe", response, [
    env.DB.prepare(
      "UPDATE newsletter_subscribers SET unsubscribed_at = ?1 WHERE unsubscribe_token = ?2 AND unsubscribed_at IS NULL"
    ).bind(new Date(now * 1e3).toISOString(), await sha256(parsed.data.token))
  ], now);
  return json(result.value);
}
__name(unsubscribeNewsletter, "unsubscribeNewsletter");

// worker/index.ts
async function routeApi(request, env, ctx) {
  const { pathname } = new URL(request.url);
  if (pathname === "/api/v1/contact") return createContact(request, env, ctx);
  if (pathname === "/api/v1/leads") return createGuideLead(request, env, ctx);
  if (pathname === "/api/v1/newsletter") return createNewsletterSubscription(request, env, ctx);
  if (pathname === "/api/v1/newsletter/unsubscribe") return unsubscribeNewsletter(request, env);
  if (pathname === "/api/v1/download-grant") return downloadGrant(request, env);
  if (pathname.startsWith("/api/v1/admin/") || pathname.startsWith("/api/v1/auth/")) {
    const identity = await authenticateAccessAdmin(env, await verifyCloudflareAccess(request, env));
    if (pathname.startsWith("/api/v1/admin/")) return adminApi(request, env, identity);
    if (pathname === "/api/v1/auth/sign-in") return signIn(request, identity);
    if (pathname === "/api/v1/auth/session") return sessionStatus(request, identity);
    if (pathname === "/api/v1/auth/sign-out") return signOut(request);
  }
  throw new HttpError(404, "not_found");
}
__name(routeApi, "routeApi");
var index_default = {
  async fetch(request, env, ctx) {
    const requestId = crypto.randomUUID();
    let originContext = null;
    try {
      assertRuntimeEnv(env);
      const redirect = httpsRedirect(request);
      if (redirect) return applySecurityHeaders(attachRequestId(redirect, requestId));
      const url = new URL(request.url);
      if (url.pathname.startsWith("/api/v1/")) {
        originContext = verifyApiOrigin(request, env);
        if (request.method === "OPTIONS") {
          return applySecurityHeaders(attachRequestId(preflightResponse(request, originContext), requestId));
        }
        enforceUploadBoundary(request);
        enforceRequestEnvelope(request);
        const rateLimit = await checkRateLimit(request);
        if (rateLimit && !rateLimit.allowed) {
          const rejected = applyCorsHeaders(rateLimitResponse(rateLimit, requestId), originContext);
          return applySecurityHeaders(attachRequestId(rejected, requestId));
        }
        const response = attachRateLimitHeaders(await routeApi(request, env, ctx), rateLimit);
        return applySecurityHeaders(attachRequestId(applyCorsHeaders(response, originContext), requestId));
      }
      return applySecurityHeaders(attachRequestId(await env.ASSETS.fetch(request), requestId));
    } catch (error) {
      const shielded = applyCorsHeaders(errorResponse(error, requestId), originContext);
      return applySecurityHeaders(attachRequestId(shielded, requestId));
    }
  },
  async scheduled(_controller, env, _ctx) {
    assertRuntimeEnv(env);
    await drainOutbox(env);
  },
  async queue(batch, env, _ctx) {
    assertRuntimeEnv(env);
    await consumeOutbox(batch, env);
  }
};
export {
  index_default as default,
  json
};
//# sourceMappingURL=index.js.map
