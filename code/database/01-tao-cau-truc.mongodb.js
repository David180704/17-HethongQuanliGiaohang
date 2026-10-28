// =============================================================================
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

// Mac dinh database "edms". Muon thu vao database khac: --eval 'var TEN_DB="edms_thu"' truoc --file
const edms = db.getSiblingDB(typeof TEN_DB === "undefined" ? "edms" : TEN_DB);
print(`Database: ${edms.getName()}\n`);

const COLLECTIONS = [
  {
    // ---------------- assignments (model Assignment) ----------------
    name: "assignments",
    indexes: [[{"shipperId":1,"shiftDate":1,"status":1},{}]],
    validator: {
      $jsonSchema: {
        "bsonType": "object",
        "required": [
          "orderId",
          "shipperId",
          "type",
          "shiftDate",
          "method",
          "_id"
        ],
        "properties": {
          "orderId": {
            "bsonType": "objectId"
          },
          "shipperId": {
            "bsonType": "objectId"
          },
          "type": {
            "bsonType": "string",
            "enum": [
              "PICKUP",
              "DELIVERY",
              "RETURN"
            ]
          },
          "shiftDate": {
            "bsonType": "date"
          },
          "status": {
            "bsonType": [
              "string",
              "null"
            ],
            "enum": [
              "ASSIGNED",
              "DONE",
              "FAILED",
              null
            ]
          },
          "assignedBy": {
            "bsonType": [
              "objectId",
              "null"
            ]
          },
          "assignedAt": {
            "bsonType": [
              "date",
              "null"
            ]
          },
          "method": {
            "bsonType": "string",
            "enum": [
              "AUTO",
              "MANUAL"
            ]
          },
          "reason": {
            "bsonType": [
              "string",
              "null"
            ]
          },
          "_id": {
            "bsonType": "objectId"
          },
          "createdAt": {
            "bsonType": [
              "date",
              "null"
            ]
          },
          "updatedAt": {
            "bsonType": [
              "date",
              "null"
            ]
          }
        }
      },
    },
  },
  {
    // ---------------- hubs (model Hub) ----------------
    name: "hubs",
    indexes: [[{"code":1},{"unique":true}]],
    validator: {
      $jsonSchema: {
        "bsonType": "object",
        "required": [
          "code",
          "name",
          "type",
          "province",
          "district",
          "_id"
        ],
        "properties": {
          "code": {
            "bsonType": "string"
          },
          "name": {
            "bsonType": "string"
          },
          "type": {
            "bsonType": "string",
            "enum": [
              "HUB",
              "POST_OFFICE"
            ]
          },
          "address": {
            "bsonType": [
              "string",
              "null"
            ]
          },
          "province": {
            "bsonType": "string"
          },
          "district": {
            "bsonType": "string"
          },
          "location": {
            "bsonType": [
              "object",
              "null"
            ],
            "properties": {
              "lat": {
                "bsonType": [
                  "number",
                  "null"
                ]
              },
              "lng": {
                "bsonType": [
                  "number",
                  "null"
                ]
              }
            }
          },
          "isActive": {
            "bsonType": [
              "bool",
              "null"
            ]
          },
          "_id": {
            "bsonType": "objectId"
          },
          "createdAt": {
            "bsonType": [
              "date",
              "null"
            ]
          },
          "updatedAt": {
            "bsonType": [
              "date",
              "null"
            ]
          }
        }
      },
    },
  },
  {
    // ---------------- orderdrafts (model OrderDraft) ----------------
    name: "orderdrafts",
    indexes: [[{"draftToken":1},{"unique":true}],[{"createdAt":1},{"expireAfterSeconds":86400}]],
    validator: {
      $jsonSchema: {
        "bsonType": "object",
        "required": [
          "draftToken",
          "payload",
          "_id"
        ],
        "properties": {
          "draftToken": {
            "bsonType": "string"
          },
          "payload": {},
          "customerId": {
            "bsonType": [
              "objectId",
              "null"
            ]
          },
          "createdAt": {
            "bsonType": [
              "date",
              "null"
            ]
          },
          "_id": {
            "bsonType": "objectId"
          }
        }
      },
    },
  },
  {
    // ---------------- orders (model Order) ----------------
    name: "orders",
    indexes: [[{"trackingCode":1},{"unique":true}],[{"customerId":1,"status":1,"createdAt":-1},{}]],
    validator: {
      $jsonSchema: {
        "bsonType": "object",
        "required": [
          "trackingCode",
          "customerId",
          "customerName",
          "pickupLocationId",
          "pickupWard",
          "receiver",
          "item",
          "serviceTypeId",
          "serviceName",
          "zone",
          "chargeableWeight",
          "_id"
        ],
        "properties": {
          "trackingCode": {
            "bsonType": "string"
          },
          "customerId": {
            "bsonType": "objectId"
          },
          "customerName": {
            "bsonType": "string"
          },
          "pickupLocationId": {
            "bsonType": "objectId"
          },
          "pickupWard": {
            "bsonType": "string"
          },
          "receiver": {
            "bsonType": "object",
            "required": [
              "name",
              "phone",
              "address",
              "province",
              "district",
              "ward"
            ],
            "properties": {
              "name": {
                "bsonType": "string"
              },
              "phone": {
                "bsonType": "string"
              },
              "address": {
                "bsonType": "string"
              },
              "province": {
                "bsonType": "string"
              },
              "district": {
                "bsonType": "string"
              },
              "ward": {
                "bsonType": "string"
              }
            }
          },
          "item": {
            "bsonType": "object",
            "required": [
              "name",
              "weightGram",
              "length",
              "width",
              "height"
            ],
            "properties": {
              "name": {
                "bsonType": "string"
              },
              "weightGram": {
                "bsonType": "number",
                "minimum": 1
              },
              "length": {
                "bsonType": "number",
                "minimum": 1
              },
              "width": {
                "bsonType": "number",
                "minimum": 1
              },
              "height": {
                "bsonType": "number",
                "minimum": 1
              },
              "declaredValue": {
                "bsonType": [
                  "number",
                  "null"
                ],
                "minimum": 0
              },
              "packingType": {
                "bsonType": [
                  "string",
                  "null"
                ],
                "enum": [
                  "BOX",
                  "BAG",
                  "PALLET",
                  "ENVELOPE",
                  "OTHER",
                  null
                ]
              },
              "note": {
                "bsonType": [
                  "string",
                  "null"
                ]
              }
            }
          },
          "flags": {
            "bsonType": [
              "object",
              "null"
            ],
            "properties": {
              "fragile": {
                "bsonType": [
                  "bool",
                  "null"
                ]
              },
              "highValue": {
                "bsonType": [
                  "bool",
                  "null"
                ]
              },
              "isVehicle": {
                "bsonType": [
                  "bool",
                  "null"
                ]
              }
            }
          },
          "serviceTypeId": {
            "bsonType": "objectId"
          },
          "serviceName": {
            "bsonType": "string"
          },
          "zone": {
            "bsonType": "string",
            "enum": [
              "INNER_DISTRICT",
              "INNER_PROVINCE",
              "INTER_PROVINCE",
              "INTER_REGION"
            ]
          },
          "chargeableWeight": {
            "bsonType": "number"
          },
          "fee": {
            "bsonType": [
              "object",
              "null"
            ],
            "properties": {
              "base": {
                "bsonType": [
                  "number",
                  "null"
                ]
              },
              "weightSurcharge": {
                "bsonType": [
                  "number",
                  "null"
                ]
              },
              "serviceSurcharge": {
                "bsonType": [
                  "number",
                  "null"
                ]
              },
              "specialSurcharge": {
                "bsonType": [
                  "number",
                  "null"
                ]
              },
              "total": {
                "bsonType": [
                  "number",
                  "null"
                ]
              }
            }
          },
          "cod": {
            "bsonType": [
              "object",
              "null"
            ],
            "properties": {
              "enabled": {
                "bsonType": [
                  "bool",
                  "null"
                ]
              },
              "amount": {
                "bsonType": [
                  "number",
                  "null"
                ],
                "minimum": 0,
                "maximum": 20000000
              },
              "feePayer": {
                "bsonType": [
                  "string",
                  "null"
                ],
                "enum": [
                  "SHOP_PREPAID",
                  "RECIPIENT_PAID",
                  "DEDUCT_FROM_COD",
                  null
                ]
              },
              "feePaymentMethod": {
                "bsonType": [
                  "string",
                  "null"
                ],
                "enum": [
                  "QR",
                  "CASH",
                  null
                ]
              },
              "feePaid": {
                "bsonType": [
                  "bool",
                  "null"
                ]
              },
              "feePaidAt": {
                "bsonType": [
                  "date",
                  "null"
                ]
              },
              "collected": {
                "bsonType": [
                  "bool",
                  "null"
                ]
              },
              "collectedAt": {
                "bsonType": [
                  "date",
                  "null"
                ]
              },
              "method": {
                "bsonType": [
                  "string",
                  "null"
                ],
                "enum": [
                  "CASH",
                  "TRANSFER",
                  null
                ]
              },
              "txnRef": {
                "bsonType": [
                  "string",
                  "null"
                ]
              }
            }
          },
          "status": {
            "bsonType": [
              "string",
              "null"
            ],
            "enum": [
              "CREATED",
              "CONFIRMED",
              "PICKUP_ASSIGNED",
              "PICKED_UP",
              "SORTED",
              "IN_TRANSIT",
              "AT_HUB",
              "AT_DEST_HUB",
              "DELIVERY_ASSIGNED",
              "OUT_FOR_DELIVERY",
              "DELIVERED",
              "PICKUP_FAILED",
              "DELIVERY_FAILED",
              "RESCHEDULED",
              "RETURNING",
              "RETURNED",
              "CANCELLED",
              "INCIDENT",
              null
            ]
          },
          "statusHistory": {
            "bsonType": [
              "array",
              "null"
            ],
            "items": {
              "bsonType": "object",
              "required": [
                "status"
              ],
              "properties": {
                "status": {
                  "bsonType": "string",
                  "enum": [
                    "CREATED",
                    "CONFIRMED",
                    "PICKUP_ASSIGNED",
                    "PICKED_UP",
                    "SORTED",
                    "IN_TRANSIT",
                    "AT_HUB",
                    "AT_DEST_HUB",
                    "DELIVERY_ASSIGNED",
                    "OUT_FOR_DELIVERY",
                    "DELIVERED",
                    "PICKUP_FAILED",
                    "DELIVERY_FAILED",
                    "RESCHEDULED",
                    "RETURNING",
                    "RETURNED",
                    "CANCELLED",
                    "INCIDENT"
                  ]
                },
                "at": {
                  "bsonType": [
                    "date",
                    "null"
                  ]
                },
                "by": {
                  "bsonType": [
                    "objectId",
                    "null"
                  ]
                },
                "note": {
                  "bsonType": [
                    "string",
                    "null"
                  ]
                },
                "location": {
                  "bsonType": [
                    "object",
                    "null"
                  ],
                  "properties": {
                    "lat": {
                      "bsonType": [
                        "number",
                        "null"
                      ]
                    },
                    "lng": {
                      "bsonType": [
                        "number",
                        "null"
                      ]
                    }
                  }
                }
              }
            }
          },
          "deliveryAttempts": {
            "bsonType": [
              "number",
              "null"
            ]
          },
          "assignedTo": {
            "bsonType": [
              "objectId",
              "null"
            ]
          },
          "settlementId": {
            "bsonType": [
              "objectId",
              "null"
            ]
          },
          "_id": {
            "bsonType": "objectId"
          },
          "createdAt": {
            "bsonType": [
              "date",
              "null"
            ]
          },
          "updatedAt": {
            "bsonType": [
              "date",
              "null"
            ]
          }
        }
      },
    },
  },
  {
    // ---------------- pickuplocations (model PickupLocation) ----------------
    name: "pickuplocations",
    indexes: [[{"customerId":1,"isActive":1},{}]],
    validator: {
      $jsonSchema: {
        "bsonType": "object",
        "required": [
          "customerId",
          "label",
          "contactName",
          "contactPhone",
          "address",
          "province",
          "district",
          "ward",
          "serviceAreaId",
          "_id"
        ],
        "properties": {
          "customerId": {
            "bsonType": "objectId"
          },
          "label": {
            "bsonType": "string"
          },
          "contactName": {
            "bsonType": "string"
          },
          "contactPhone": {
            "bsonType": "string"
          },
          "address": {
            "bsonType": "string"
          },
          "province": {
            "bsonType": "string"
          },
          "district": {
            "bsonType": "string"
          },
          "ward": {
            "bsonType": "string"
          },
          "serviceAreaId": {
            "bsonType": "objectId"
          },
          "isDefault": {
            "bsonType": [
              "bool",
              "null"
            ]
          },
          "isActive": {
            "bsonType": [
              "bool",
              "null"
            ]
          },
          "_id": {
            "bsonType": "objectId"
          },
          "createdAt": {
            "bsonType": [
              "date",
              "null"
            ]
          },
          "updatedAt": {
            "bsonType": [
              "date",
              "null"
            ]
          }
        }
      },
    },
  },
  {
    // ---------------- pricetables (model PriceTable) ----------------
    name: "pricetables",
    indexes: [[{"serviceTypeId":1,"zone":1,"effectiveFrom":1},{}]],
    validator: {
      $jsonSchema: {
        "bsonType": "object",
        "required": [
          "serviceTypeId",
          "zone",
          "weightTiers",
          "effectiveFrom",
          "_id"
        ],
        "properties": {
          "serviceTypeId": {
            "bsonType": "objectId"
          },
          "zone": {
            "bsonType": "string",
            "enum": [
              "INNER_DISTRICT",
              "INNER_PROVINCE",
              "INTER_PROVINCE",
              "INTER_REGION"
            ]
          },
          "weightTiers": {
            "bsonType": "array",
            "items": {
              "bsonType": "object",
              "required": [
                "fromGram",
                "toGram",
                "basePrice",
                "pricePer500g"
              ],
              "properties": {
                "fromGram": {
                  "bsonType": "number",
                  "minimum": 0
                },
                "toGram": {
                  "bsonType": "number",
                  "minimum": 0
                },
                "basePrice": {
                  "bsonType": "number",
                  "minimum": 0
                },
                "pricePer500g": {
                  "bsonType": "number",
                  "minimum": 0
                }
              }
            }
          },
          "effectiveFrom": {
            "bsonType": "date"
          },
          "effectiveTo": {
            "bsonType": [
              "date",
              "null"
            ]
          },
          "isActive": {
            "bsonType": [
              "bool",
              "null"
            ]
          },
          "_id": {
            "bsonType": "objectId"
          },
          "createdAt": {
            "bsonType": [
              "date",
              "null"
            ]
          },
          "updatedAt": {
            "bsonType": [
              "date",
              "null"
            ]
          }
        }
      },
    },
  },
  {
    // ---------------- roles (model Role) ----------------
    name: "roles",
    indexes: [[{"code":1},{"unique":true}]],
    validator: {
      $jsonSchema: {
        "bsonType": "object",
        "required": [
          "code",
          "name",
          "_id"
        ],
        "properties": {
          "code": {
            "bsonType": "string",
            "enum": [
              "GUEST",
              "CUSTOMER",
              "SHIPPER",
              "HUB_STAFF",
              "ADMIN"
            ]
          },
          "name": {
            "bsonType": "string"
          },
          "permissions": {
            "bsonType": [
              "array",
              "null"
            ],
            "items": {
              "bsonType": "string"
            }
          },
          "inheritsFrom": {
            "bsonType": [
              "string",
              "null"
            ],
            "enum": [
              "GUEST",
              "CUSTOMER",
              "SHIPPER",
              "HUB_STAFF",
              "ADMIN",
              null
            ]
          },
          "_id": {
            "bsonType": "objectId"
          },
          "createdAt": {
            "bsonType": [
              "date",
              "null"
            ]
          },
          "updatedAt": {
            "bsonType": [
              "date",
              "null"
            ]
          }
        }
      },
    },
  },
  {
    // ---------------- routes (model Route) ----------------
    name: "routes",
    indexes: [[{"code":1},{"unique":true}]],
    validator: {
      $jsonSchema: {
        "bsonType": "object",
        "required": [
          "code",
          "name",
          "hubId",
          "maxPickupPerShift",
          "maxDeliveryPerShift",
          "_id"
        ],
        "properties": {
          "code": {
            "bsonType": "string"
          },
          "name": {
            "bsonType": "string"
          },
          "hubId": {
            "bsonType": "objectId"
          },
          "maxPickupPerShift": {
            "bsonType": "number"
          },
          "maxDeliveryPerShift": {
            "bsonType": "number"
          },
          "isActive": {
            "bsonType": [
              "bool",
              "null"
            ]
          },
          "_id": {
            "bsonType": "objectId"
          },
          "createdAt": {
            "bsonType": [
              "date",
              "null"
            ]
          },
          "updatedAt": {
            "bsonType": [
              "date",
              "null"
            ]
          }
        }
      },
    },
  },
  {
    // ---------------- serviceareas (model ServiceArea) ----------------
    name: "serviceareas",
    indexes: [[{"province":1,"district":1},{"unique":true}]],
    validator: {
      $jsonSchema: {
        "bsonType": "object",
        "required": [
          "province",
          "district",
          "region",
          "routeId",
          "_id"
        ],
        "properties": {
          "province": {
            "bsonType": "string"
          },
          "district": {
            "bsonType": "string"
          },
          "wards": {
            "bsonType": [
              "array",
              "null"
            ],
            "items": {
              "bsonType": "string"
            }
          },
          "region": {
            "bsonType": "string",
            "enum": [
              "BAC",
              "TRUNG",
              "NAM"
            ]
          },
          "routeId": {
            "bsonType": "objectId"
          },
          "_id": {
            "bsonType": "objectId"
          },
          "createdAt": {
            "bsonType": [
              "date",
              "null"
            ]
          },
          "updatedAt": {
            "bsonType": [
              "date",
              "null"
            ]
          }
        }
      },
    },
  },
  {
    // ---------------- servicetypes (model ServiceType) ----------------
    name: "servicetypes",
    indexes: [[{"code":1},{"unique":true}]],
    validator: {
      $jsonSchema: {
        "bsonType": "object",
        "required": [
          "code",
          "name",
          "surchargeRate",
          "estimatedDays",
          "_id"
        ],
        "properties": {
          "code": {
            "bsonType": "string",
            "enum": [
              "STANDARD",
              "EXPRESS"
            ]
          },
          "name": {
            "bsonType": "string"
          },
          "surchargeRate": {
            "bsonType": "number",
            "minimum": 0
          },
          "estimatedDays": {
            "bsonType": "number",
            "minimum": 0
          },
          "isActive": {
            "bsonType": [
              "bool",
              "null"
            ]
          },
          "_id": {
            "bsonType": "objectId"
          },
          "createdAt": {
            "bsonType": [
              "date",
              "null"
            ]
          },
          "updatedAt": {
            "bsonType": [
              "date",
              "null"
            ]
          }
        }
      },
    },
  },
  {
    // ---------------- shifts (model Shift) ----------------
    name: "shifts",
    indexes: [],
    validator: {
      $jsonSchema: {
        "bsonType": "object",
        "required": [
          "code",
          "name",
          "startTime",
          "endTime",
          "routeId",
          "shiftDate",
          "_id"
        ],
        "properties": {
          "code": {
            "bsonType": "string"
          },
          "name": {
            "bsonType": "string"
          },
          "startTime": {
            "bsonType": "string"
          },
          "endTime": {
            "bsonType": "string"
          },
          "routeId": {
            "bsonType": "objectId"
          },
          "shipperIds": {
            "bsonType": [
              "array",
              "null"
            ],
            "items": {
              "bsonType": "objectId"
            }
          },
          "shiftDate": {
            "bsonType": "date"
          },
          "_id": {
            "bsonType": "objectId"
          },
          "createdAt": {
            "bsonType": [
              "date",
              "null"
            ]
          },
          "updatedAt": {
            "bsonType": [
              "date",
              "null"
            ]
          }
        }
      },
    },
  },
  {
    // ---------------- users (model User) ----------------
    name: "users",
    indexes: [[{"email":1},{"unique":true}],[{"phone":1},{"unique":true}]],
    validator: {
      $jsonSchema: {
        "bsonType": "object",
        "required": [
          "email",
          "phone",
          "passwordHash",
          "fullName",
          "role",
          "_id"
        ],
        "properties": {
          "email": {
            "bsonType": "string"
          },
          "phone": {
            "bsonType": "string"
          },
          "passwordHash": {
            "bsonType": "string"
          },
          "fullName": {
            "bsonType": "string"
          },
          "role": {
            "bsonType": "string",
            "enum": [
              "GUEST",
              "CUSTOMER",
              "SHIPPER",
              "HUB_STAFF",
              "ADMIN"
            ]
          },
          "status": {
            "bsonType": [
              "string",
              "null"
            ],
            "enum": [
              "PENDING",
              "ACTIVE",
              "LOCKED",
              null
            ]
          },
          "customerType": {
            "bsonType": [
              "string",
              "null"
            ],
            "enum": [
              "INDIVIDUAL",
              "BUSINESS",
              null
            ]
          },
          "shopName": {
            "bsonType": [
              "string",
              "null"
            ]
          },
          "taxCode": {
            "bsonType": [
              "string",
              "null"
            ]
          },
          "hubId": {
            "bsonType": [
              "objectId",
              "null"
            ]
          },
          "routeIds": {
            "bsonType": [
              "array",
              "null"
            ],
            "items": {
              "bsonType": "objectId"
            }
          },
          "maxPickupPerShift": {
            "bsonType": [
              "number",
              "null"
            ]
          },
          "maxDeliveryPerShift": {
            "bsonType": [
              "number",
              "null"
            ]
          },
          "bankAccount": {
            "bsonType": [
              "object",
              "null"
            ],
            "properties": {
              "bankName": {
                "bsonType": [
                  "string",
                  "null"
                ]
              },
              "accountNumber": {
                "bsonType": [
                  "string",
                  "null"
                ]
              },
              "accountName": {
                "bsonType": [
                  "string",
                  "null"
                ]
              }
            }
          },
          "_id": {
            "bsonType": "objectId"
          },
          "createdAt": {
            "bsonType": [
              "date",
              "null"
            ]
          },
          "updatedAt": {
            "bsonType": [
              "date",
              "null"
            ]
          }
        }
      },
    },
  },
];

const existing = edms.getCollectionNames();
for (const c of COLLECTIONS) {
  // validationLevel strict: moi lan them/sua deu phai qua rang buoc; sai -> bao loi, khong luu
  const options = { validator: c.validator, validationLevel: "strict", validationAction: "error" };
  if (existing.includes(c.name)) {
    edms.runCommand({ collMod: c.name, ...options });
    print(`~ ${c.name}: da co, cap nhat rang buoc`);
  } else {
    edms.createCollection(c.name, options);
    print(`+ ${c.name}: tao moi`);
  }
  for (const [keys, opts] of c.indexes) edms.getCollection(c.name).createIndex(keys, opts);
  const names = edms.getCollection(c.name).getIndexes().map((i) => i.name).filter((n) => n !== "_id_");
  print(`    chi muc: ${names.join(", ") || "(chi co _id)"}`);
}
print(`\nXong: ${COLLECTIONS.length} collection trong database "${edms.getName()}". Buoc tiep: 02-du-lieu-mau.mongodb.js`);
