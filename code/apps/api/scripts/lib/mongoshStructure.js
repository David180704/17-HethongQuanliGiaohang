// Dung cau truc CSDL (collection + $jsonSchema + chi muc) TU CHINH cac model Mongoose,
// de file mongosh sinh ra luon khop voi code ung dung (mot nguon su that duy nhat).
import * as models from "../../src/models/index.js";

const NUMBER_TYPES = "number"; // khop int, long, double, decimal

function scalarSchema(schemaType) {
  switch (schemaType.instance) {
    case "String": {
      const out = { bsonType: "string" };
      if (schemaType.enumValues?.length) out.enum = [...schemaType.enumValues];
      return out;
    }
    case "Number": {
      const out = { bsonType: NUMBER_TYPES };
      if (typeof schemaType.options.min === "number") out.minimum = schemaType.options.min;
      if (typeof schemaType.options.max === "number") out.maximum = schemaType.options.max;
      return out;
    }
    case "Boolean":
      return { bsonType: "bool" };
    case "Date":
      return { bsonType: "date" };
    case "ObjectId":
      return { bsonType: "objectId" };
    case "Mixed":
      return {}; // bat ky kieu nao
    case "Embedded":
      return schemaToJson(schemaType.schema);
    case "Array": {
      const items = schemaType.schema
        ? schemaToJson(schemaType.schema)
        : scalarSchema(schemaType.embeddedSchemaType || schemaType.caster);
      return { bsonType: "array", items };
    }
    default:
      return {};
  }
}

// Truong khong bat buoc: app co the ghi null (vd assignedTo: null) -> cho phep "null".
function allowNull(schema) {
  if (!schema.bsonType) return schema;
  const types = Array.isArray(schema.bsonType) ? schema.bsonType : [schema.bsonType];
  const out = { ...schema, bsonType: [...new Set([...types, "null"])] };
  if (out.enum) out.enum = [...out.enum, null];
  return out;
}

export function schemaToJson(schema) {
  const root = { bsonType: "object", required: [], properties: {} };
  schema.eachPath((path, schemaType) => {
    if (path === "__v") return;
    const parts = path.split(".");
    let node = root;
    for (const part of parts.slice(0, -1)) {
      node.properties[part] ??= { bsonType: ["object", "null"], required: [], properties: {} };
      node = node.properties[part];
    }
    const leaf = parts.at(-1);
    const required = path === "_id" || schemaType.isRequired === true;
    const json = scalarSchema(schemaType);
    node.properties[leaf] = required ? json : allowNull(json);
    if (required) node.required.push(leaf);
  });
  const prune = (node) => {
    if (node.required && node.required.length === 0) delete node.required;
    for (const child of Object.values(node.properties || {})) prune(child);
    if (node.items) prune(node.items);
  };
  prune(root);
  return root;
}

const INDEX_OPTIONS = ["unique", "sparse", "expireAfterSeconds", "partialFilterExpression", "name"];

/** @returns {{ name: string, model: string, jsonSchema: object, indexes: Array<[object, object]> }[]} */
export function buildStructure() {
  return Object.values(models)
    .map((model) => ({
      name: model.collection.collectionName,
      model: model.modelName,
      jsonSchema: schemaToJson(model.schema),
      indexes: model.schema.indexes().map(([fields, options]) => [
        fields,
        Object.fromEntries(INDEX_OPTIONS.filter((k) => options[k] !== undefined).map((k) => [k, options[k]])),
      ]),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

const HEADER = `// =============================================================================
// EDMS - BUOC 1: TAO CAU TRUC CSDL (collection, rang buoc du lieu, chi muc)
// =============================================================================
// FILE SINH TU DONG tu cac model Mongoose (code/apps/api/src/models) bang lenh
//   cd code/apps/api && npm run db:export
// -> luon khop voi code ung dung. Dung sua tay: sua model roi chay lai lenh tren.
//
// Chay (chon 1 cach, xem docs/HuongDanKhoiTaoCSDL.md):
//   mongosh "<chuoi ket noi>" --file 01-tao-cau-truc.mongodb.js
//   MongoDB Compass: mo tab _MONGOSH, go: load("<duong dan>/01-tao-cau-truc.mongodb.js")
//
// Chay lai nhieu lan van an toan: collection da co thi chi cap nhat rang buoc,
// KHONG xoa du lieu.
// =============================================================================
`;

export function renderStructureScript(structure = buildStructure()) {
  const pretty = (value, pad) => JSON.stringify(value, null, 2).replace(/\n/g, `\n${pad}`);
  const blocks = structure.map(
    (c) => `  {
    // ---------------- ${c.name} (model ${c.model}) ----------------
    name: ${JSON.stringify(c.name)},
    indexes: ${JSON.stringify(c.indexes)},
    validator: {
      $jsonSchema: ${pretty(c.jsonSchema, "      ")},
    },
  }`,
  );
  return `${HEADER}
// Mac dinh database "edms". Muon thu vao database khac: --eval 'var TEN_DB="edms_thu"' truoc --file
const edms = db.getSiblingDB(typeof TEN_DB === "undefined" ? "edms" : TEN_DB);
print(\`Database: \${edms.getName()}\\n\`);

const COLLECTIONS = [
${blocks.join(",\n")},
];

const existing = edms.getCollectionNames();
for (const c of COLLECTIONS) {
  // validationLevel strict: moi lan them/sua deu phai qua rang buoc; sai -> bao loi, khong luu
  const options = { validator: c.validator, validationLevel: "strict", validationAction: "error" };
  if (existing.includes(c.name)) {
    edms.runCommand({ collMod: c.name, ...options });
    print(\`~ \${c.name}: da co, cap nhat rang buoc\`);
  } else {
    edms.createCollection(c.name, options);
    print(\`+ \${c.name}: tao moi\`);
  }
  for (const [keys, opts] of c.indexes) edms.getCollection(c.name).createIndex(keys, opts);
  const names = edms.getCollection(c.name).getIndexes().map((i) => i.name).filter((n) => n !== "_id_");
  print(\`    chi muc: \${names.join(", ") || "(chi co _id)"}\`);
}
print(\`\\nXong: \${COLLECTIONS.length} collection trong database "\${edms.getName()}". Buoc tiep: 02-du-lieu-mau.mongodb.js\`);
`;
}
