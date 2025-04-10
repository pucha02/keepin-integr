// import fetch from "node-fetch";
// import { MongoClient } from "mongodb";

// // Общие настройки и конфигурация
// const config = {
//   keepin: {
//     headers: {
//       "X-Auth-Token": "XSrcGKCWebJUd7zwndHa57Hx",
//       "Content-Type": "application/json"
//     },
//     urls: {
//       getProducts: "https://api.keepincrm.com/v1/materials",
//       updateMaterialBySku: (sku) => `https://api.keepincrm.com/v1/materials/sku/${sku}`
//     }
//   },
//   sitniks: {
//     headers: {
//       "Authorization": "Bearer Dioyg6qqdMhyx5iQz6BU24ZBz83HAIdPIEJ5X51YEvw",
//       "Content-Type": "application/json"
//     },
//     urls: {
//       getProducts: "https://crm.sitniks.com/open-api/products",
//       getWarehouses: "https://crm.sitniks.com/open-api/warehouses",
//       updateStock: "https://crm.sitniks.com/open-api/inventory/quantity"
//     }
//   },
//   office: {
//     id: 98279,
//     hash: "hash123",
//     name: "Main Office"
//   },
//   sitniksWarehouseId: 4505,
//   mongodb: {
//     uri: "mongodb://localhost:27017",
//     dbName: "integrationDB"
//   }
// };

// /**
//  * Функция для подключения к MongoDB и получения коллекции для хранения состояния синхронизации.
//  * Каждый документ может выглядеть так:
//  * { sku: "ABC123", stock: 1000, lastSyncedAt: ISODate("2025-04-09T12:34:56Z"), updatedFrom: "keepin" }
//  */
// async function getDbCollection() {
//   const client = new MongoClient('mongodb+srv://salaryapp5:aM5DtXeMRklFosy5@cluster0.l1wfm.mongodb.net/test?retryWrites=true&w=majority', { useUnifiedTopology: true });
//   await client.connect();
//   const db = client.db(config.mongodb.dbName);
//   return { collection: db.collection("stockStates"), client };
// }

// /**
//  * Функция upsert для сохранения (или обновления) состояния по SKU.
//  * Поля:
//  * - stock: фактический остаток
//  * - lastSyncedAt: время, когда состояние было получено (наш штамп времени)
//  * - updatedFrom: источник обновления ("keepin" или "sitniks")
//  */
// async function upsertStockState(sku, stock, updatedFrom) {
//   const { collection, client } = await getDbCollection();
//   try {
//     const now = new Date();
//     await collection.updateOne(
//       { sku },
//       {
//         $set: { stock, lastSyncedAt: now, updatedFrom },
//         $push: { history: { stock, updatedFrom, timestamp: now } }
//       },
//       { upsert: true }
//     );
//   } catch (error) {
//     console.error(`Ошибка обновления состояния для SKU ${sku}:`, error);
//   } finally {
//     client.close();
//   }
// }

// /**
//  * Получаем материалы из Keepin.
//  */
// async function fetchKeepinProducts() {
//   try {
//     const res = await fetch(config.keepin.urls.getProducts, { headers: config.keepin.headers });
//     if (!res.ok) throw new Error(`Ошибка запроса к Keepin: ${res.status}`);
//     const data = await res.json();
//     if (!data.items || data.items.length === 0) {
//       console.log("Нет материалов для обновления в Keepin.");
//       return [];
//     }
//     return data.items;
//   } catch (error) {
//     console.error("Ошибка при получении материалов из Keepin:", error);
//     return [];
//   }
// }

// /**
//  * Получаем список товаров из Sitniks.
//  */
// async function fetchSitniksProducts() {
//   try {
//     const res = await fetch(config.sitniks.urls.getProducts, { headers: config.sitniks.headers });
//     if (!res.ok) throw new Error(`Ошибка запроса к Sitniks: ${res.status}`);
//     const rawData = await res.json();
//     let products = [];
//     if (Array.isArray(rawData)) {
//       products = rawData;
//     } else if (rawData.data && Array.isArray(rawData.data)) {
//       products = rawData.data;
//     } else {
//       console.error("Структура данных из Sitniks не соответствует ожидаемой");
//     }
//     return products;
//   } catch (error) {
//     console.error("Ошибка при получении товаров из Sitniks:", error);
//     return [];
//   }
// }

// /**
//  * Обновление отдельного материала в Keepin на основе данных из Sitniks.
//  * Если данные из Sitniks изменились (например, уровень остатка отличается),
//  * то обновляем Keepin и сохраняем новое состояние в MongoDB.
//  */
// async function updateMaterialInKeepin(material, sitniksMatch) {
//   // Получаем остаток с первой информации о складе из Sitniks (если указан)
//   let newAvailable = material.available;
//   if (
//     sitniksMatch.variation.warehouses &&
//     Array.isArray(sitniksMatch.variation.warehouses) &&
//     sitniksMatch.variation.warehouses.length > 0
//   ) {
//     const warehouseData = sitniksMatch.variation.warehouses[0];
//     newAvailable = (warehouseData.availableQuantity !== undefined)
//       ? warehouseData.availableQuantity
//       : material.available;
//   }

//   // Если уровень остатка не изменился, можно пропустить обновление
//   if (newAvailable === material.available) {
//     console.log(`Остаток для SKU ${material.sku} не изменился (${newAvailable}).`);
//     return;
//   }

//   // Формируем объект для обновления в Keepin (можно расширить, если потребуется маппинг других полей)
//   const updateObject = {
//     sku: material.sku,
//     title: material.title,
//     unit: material.unit || "шт.",
//     price: material.price,
//     cost: material.cost,
//     currency: material.currency || "UAH",
//     cost_currency: material.cost_currency || "UAH",
//     weight: sitniksMatch.variation.weight || 0,
//     volume: sitniksMatch.variation.volumeWeight || 0,
//     asset_url: material.asset_url || "",
//     link_url: material.link_url || "",
//     category_id: material.category_id || 0,
//     vat_group_title: material.vat_group_title || "",
//     irrelevant: material.irrelevant,
//     available: newAvailable,
//     stock_rests_attributes: [
//       {
//         office_id: config.office.id,
//         office_hash_id: config.office.hash,
//         office_name: config.office.name,
//         available: newAvailable
//       }
//     ],
//     custom_fields: material.custom_fields || [],
//     named_custom_prices: material.named_custom_prices || { "Опт": 10, "Інтернет": "12 USD" }
//   };

//   const updateURL = config.keepin.urls.updateMaterialBySku(material.sku);
//   console.log(`Обновляем материал в Keepin (SKU: ${material.sku}), новый остаток: ${newAvailable}`);
//   try {
//     const res = await fetch(updateURL, {
//       method: "PUT",
//       headers: config.keepin.headers,
//       body: JSON.stringify(updateObject)
//     });
//     if (!res.ok) {
//       const errorText = await res.text();
//       console.error(`Ошибка обновления материала с SKU ${material.sku}: ${res.status} - ${errorText}`);
//     } else {
//       const result = await res.json();
//       console.log(`Успешно обновлён материал (SKU: ${material.sku}). Результат:`, result);
//       // Обновляем состояние в MongoDB (обновление получено от Sitniks)
//       await upsertStockState(material.sku, newAvailable, "sitniks");
//     }
//   } catch (error) {
//     console.error(`Ошибка при запросе обновления материала с SKU ${material.sku}:`, error);
//   }
// }

// /**
//  * Обновляем все материалы в Keepin.
//  * Для каждого материала ищем соответствие в Sitniks (по SKU) и вызываем updateMaterialInKeepin.
//  */
// async function updateMaterialsInKeepin() {
//   const keepinProducts = await fetchKeepinProducts();
//   if (keepinProducts.length === 0) return;

//   const sitniksProducts = await fetchSitniksProducts();
//   if (sitniksProducts.length === 0) {
//     console.error("Не удалось получить данные товаров из Sitniks для обновления Keepin.");
//     return;
//   }
//   const sitniksBySku = {};
//   sitniksProducts.forEach(prod => {
//     if (prod.variations && Array.isArray(prod.variations)) {
//       prod.variations.forEach(variation => {
//         if (variation.sku) {
//           sitniksBySku[variation.sku] = { product: prod, variation: variation };
//         }
//       });
//     }
//   });

//   for (const material of keepinProducts) {
//     const sku = material.sku;
//     const sitniksMatch = sitniksBySku[sku];
//     if (!sitniksMatch) {
//       console.error(`Не найден товар из Sitniks для SKU ${sku}`);
//       continue;
//     }
//     await updateMaterialInKeepin(material, sitniksMatch);
//   }
// }

// /**
//  * Обновление остатков в Sitniks на основании данных из Keepin.
//  * Если данные в Keepin (остаток) изменились относительно данных в Sitniks, выполняем обновление.
//  */
// async function updateStockInSitniks() {
//   try {
//     console.log("Запрашиваем товары из Keepin для обновления остатков в Sitniks...");
//     const keepinProducts = await fetchKeepinProducts();
//     if (keepinProducts.length === 0) {
//       console.log("Нет товаров из Keepin для обновления остатков.");
//       return;
//     }

//     const sitniksProducts = await fetchSitniksProducts();
//     if (sitniksProducts.length === 0) {
//       console.error("Не удалось получить данные из Sitniks для обновления остатков.");
//       return;
//     }

//     const stockUpdates = [];
//     for (const product of keepinProducts) {
//       let variationId = null;
//       let sitniksStock = 0;
//       for (const sitProduct of sitniksProducts) {
//         if (sitProduct.variations && Array.isArray(sitProduct.variations)) {
//           const match = sitProduct.variations.find(variation => variation.sku === product.sku);
//           if (match) {
//             variationId = match.id;
//             sitniksStock = match.availableQuantity;
//             break;
//           }
//         }
//       }
//       if (!variationId) {
//         console.error(`Не найдена вариация для товара с SKU ${product.sku}`);
//         continue;
//       }
//       // Если остаток в Keepin отличается от остатка, полученного из Sitniks, формируем обновление
//       if (product.available !== sitniksStock) {
//         stockUpdates.push({
//           id: variationId,
//           quantity: product.available,
//           warehouseId: config.sitniksWarehouseId
//         });
//       }
//       // Сохраняем состояние в базу с источником "keepin"
//       await upsertStockState(product.sku, product.available, "keepin");
//     }

//     if (stockUpdates.length === 0) {
//       console.log("Нет корректных данных для обновления остатков в Sitniks.");
//       return;
//     }

//     console.log("Подготовлены данные для обновления остатков в Sitniks:", stockUpdates);
//     const res = await fetch(config.sitniks.urls.updateStock, {
//       method: "PUT",
//       headers: config.sitniks.headers,
//       body: JSON.stringify({ productVariations: stockUpdates })
//     });

//     if (!res.ok) {
//       const errorText = await res.text();
//       console.error(`Ошибка обновления остатков в Sitniks: ${res.status} - ${errorText}`);
//     } else {
//       console.log("Остатки успешно обновлены в Sitniks.");
//     }
//   } catch (error) {
//     console.error("Ошибка при обновлении остатков в Sitniks:", error);
//   }
// }

// /**
//  * Основная функция синхронизации: запускает обновление остатков и материалов.
//  */
// async function syncStock() {
//   console.log("\n==== Начало цикла синхронизации ====");
//   await updateStockInSitniks();
//   await updateMaterialsInKeepin();
//   console.log("==== Завершение цикла синхронизации ====\n");
// }

// // Запускаем синхронизацию сразу и затем каждые 10 секунд.
// syncStock();
// setInterval(syncStock, 10000);
// Импорт модулей



// import express from 'express';
// import fetch from 'node-fetch'; // Если используете node-fetch v2, или настройте импорт для v3
// const app = express();
// const PORT = 3000;

// // Middleware для обработки JSON-данных
// app.use(express.json());

// // --- Конфигурация API и констант ---

// // Заголовки для KeepinCRM
// const headersKeepin = {
//   "X-Auth-Token": "XSrcGKCWebJUd7zwndHa57Hx",
//   "Content-Type": "application/json"
// };

// // Заголовки для SitniksCRM
// const headersSitniks = {
//   "Authorization": "Bearer Dioyg6qqdMhyx5iQz6BU24ZBz83HAIdPIEJ5X51YEvw",
//   "Content-Type": "application/json"
// };

// // URL для KeepinCRM
// const getProductsKeepinURL = "https://api.keepincrm.com/v1/materials";
// const updateMaterialBySkuURL = (sku) => `https://api.keepincrm.com/v1/materials/sku/${sku}`;

// // URL для SitniksCRM
// const getProductsSitniksURL = "https://crm.sitniks.com/open-api/products";
// const updateStockSitniksURL = "https://crm.sitniks.com/open-api/inventory/quantity";

// // ID склада и другие константы
// const warehouseIdSitniks = 4505;
// const OFFICE_ID = 98279;
// const OFFICE_HASH_ID = "hash123";
// const OFFICE_NAME = "Main Office";

// // --- Механизм блокировки по SKU ---
// // Простой in-memory lock (подходит для одного инстанса Node)
// const locks = {};
// async function acquireLock(key) {
//   while (locks[key]) {
//     await new Promise(resolve => setTimeout(resolve, 100));
//   }
//   locks[key] = true;
// }
// function releaseLock(key) {
//   delete locks[key];
// }

// // --- Хранилище времени последнего обновления для каждого SKU ---
// // Это помогает избежать обратной синхронизации из-за собственных обновлений.
// const lastIntegrationUpdate = {};
// // Интервал, в течение которого будем игнорировать вебхук-события (в мс)
// const IGNORE_INTERVAL = 5000;

// // --- Вспомогательные функции ---

// // Получение актуальных данных из Keepin по SKU
// async function getLatestKeepinDataBySku(sku) {
//   try {
//     const response = await fetch(getProductsKeepinURL, { headers: headersKeepin });
//     if (!response.ok) throw new Error(`Ошибка запроса к Keepin: ${response.status}`);
//     const data = await response.json();
//     if (!data.items || data.items.length === 0) {
//       console.error("В Keepin нет материалов");
//       return null;
//     }
//     const material = data.items.find(item => item.sku === sku);
//     if (!material) {
//       console.error(`Материал с SKU ${sku} не найден в Keepin`);
//       return null;
//     }
//     return material;
//   } catch (error) {
//     console.error("Ошибка в getLatestKeepinDataBySku:", error);
//     return null;
//   }
// }

// // Получение ID вариации товара в Sitniks по SKU
// async function getVariationIdBySku(sku) {
//   try {
//     const response = await fetch(getProductsSitniksURL, { headers: headersSitniks });
//     if (!response.ok) throw new Error(`Ошибка запроса к Sitniks: ${response.status}`);
//     const data = await response.json();
//     let products = [];
//     if (Array.isArray(data)) {
//       products = data;
//     } else if (data.data && Array.isArray(data.data)) {
//       products = data.data;
//     } else {
//       console.error("Непредвиденная структура данных от Sitniks");
//       return null;
//     }
//     for (let product of products) {
//       if (product.variations && Array.isArray(product.variations)) {
//         const match = product.variations.find(variation => variation.sku === sku);
//         if (match) return match.id;
//       }
//     }
//     return null;
//   } catch (error) {
//     console.error("Ошибка в getVariationIdBySku:", error);
//     return null;
//   }
// }

// // Получение текущего остатка для вариации в Sitniks по variationId
// async function getCurrentStockForVariation(variationId) {
//   try {
//     const response = await fetch(getProductsSitniksURL, { headers: headersSitniks });
//     if (!response.ok) throw new Error(`Ошибка получения данных для variationId ${variationId}: ${response.status}`);
//     const data = await response.json();
//     let products = [];
//     if (Array.isArray(data)) {
//       products = data;
//     } else if (data.data && Array.isArray(data.data)) {
//       products = data.data;
//     } else {
//       console.error("Непредвиденная структура данных от Sitniks");
//       return null;
//     }
//     for (let product of products) {
//       if (product.variations && Array.isArray(product.variations)) {
//         const variation = product.variations.find(v => v.id === variationId);
//         if (variation) {
//           if (variation.warehouses &&
//               Array.isArray(variation.warehouses) &&
//               variation.warehouses.length > 0 &&
//               typeof variation.warehouses[0].availableQuantity !== 'undefined') {
//             return variation.warehouses[0].availableQuantity;
//           }
//           return 0;
//         }
//       }
//     }
//     return null;
//   } catch (error) {
//     console.error("Ошибка в getCurrentStockForVariation:", error);
//     return null;
//   }
// }

// // --- Обработка входящего вебхука от KeepinCRM ---
// // Пример тела запроса:
// // {
// //   "type": "Transfer" или "StockCorrection",
// //   "material_sku": "102",
// //   "amount": 200,         // Может быть положительным или отрицательным
// //   "additional text": "From KeepinCRM",
// //   "cost": 200,
// //   "comment": ""
// // }
// app.post('/api/webhook/keepin', async (req, res) => {
//   const { type, material_sku, amount, cost, comment } = req.body;
//   console.log("Получен webhook от Keepin:", req.body);

//   await acquireLock(material_sku);
//   try {
//     // Попытка получить актуальные данные из Keepin
//     const latestKeepinData = await getLatestKeepinDataBySku(material_sku);
//     let newAmount;
//     if (latestKeepinData && typeof latestKeepinData.stock_available !== 'undefined') {
//       // Если Keepin возвращает абсолютное значение
//       newAmount = latestKeepinData.stock_available;
//     } else {
//       // Если нет актуального абсолютного значения, рассчитываем по дельте
//       // Сначала получаем текущий остаток из Sitniks
//       const variationId = await getVariationIdBySku(material_sku);
//       if (!variationId) {
//         console.error(`В Sitniks не найдена товарная вариация для SKU ${material_sku}`);
//         return res.status(400).json({ error: `Товарная вариация для SKU ${material_sku} не найдена` });
//       }
//       const currentStock = await getCurrentStockForVariation(variationId);
//       newAmount = currentStock + parseFloat(amount);
//     }

//     // Получаем ID вариации Sitniks по SKU
//     const variationId = await getVariationIdBySku(material_sku);
//     if (!variationId) {
//       console.error(`В Sitniks не найдена товарная вариация для SKU ${material_sku}`);
//       return res.status(400).json({ error: `Товарная вариация для SKU ${material_sku} не найдена` });
//     }

//     const currentStock = await getCurrentStockForVariation(variationId);
//     console.log(`Текущий остаток для variationId ${variationId}: ${currentStock}`);
//     console.log(`Рассчитанное новое значение для SKU ${material_sku}: ${newAmount}`);

//     if (currentStock !== null && parseFloat(newAmount) === parseFloat(currentStock)) {
//       console.log(`Остаток для SKU ${material_sku} уже актуален (${newAmount}). Обновление не требуется.`);
//       return res.json({ status: "success", message: "Нет изменений" });
//     }

//     const payload = {
//       productVariations: [
//         {
//           id: variationId,
//           quantity: newAmount,
//           cost: cost,
//           comment: comment,
//           warehouseId: warehouseIdSitniks
//         }
//       ]
//     };

//     console.log("Отправляем данные в Sitniks через webhook:", payload);
//     const response = await fetch(updateStockSitniksURL, {
//       method: 'PUT',
//       headers: headersSitniks,
//       body: JSON.stringify(payload)
//     });

//     const contentLength = response.headers.get("content-length");
//     let result = {};
//     if (contentLength && parseInt(contentLength) === 0) {
//       result = {};
//     } else {
//       const text = await response.text();
//       if (text) {
//         try {
//           result = JSON.parse(text);
//         } catch (parseError) {
//           console.error("Ошибка при разборе ответа от Sitniks:", parseError);
//           result = { raw: text };
//         }
//       }
//     }

//     if (!response.ok) {
//       console.error(`Ошибка обновления в Sitniks через webhook: ${response.status} -`, result);
//       return res.status(500).json({ error: `Ошибка обновления в Sitniks: ${response.status}` });
//     }

//     console.log("Обновление через webhook прошло успешно:", result);
//     // Фиксируем время обновления для избежания циклических синхронизаций
//     lastIntegrationUpdate[material_sku] = Date.now();
//     res.json({ status: "success", result });
//   } catch (error) {
//     console.error("Ошибка обработки webhook:", error);
//     res.status(500).json({ error: "Внутренняя ошибка сервера" });
//   } finally {
//     releaseLock(material_sku);
//   }
// });


// // --- Ручные эндпоинты для синхронизации (опционально) ---

// // Синхронизация из Keepin в Sitniks
// async function syncKeepinToSitniks() {
//   try {
//     console.log('Запрашиваем товары из Keepin...');
//     const keepinResponse = await fetch(getProductsKeepinURL, { headers: headersKeepin });
//     if (!keepinResponse.ok) throw new Error(`Ошибка запроса к Keepin: ${keepinResponse.status}`);
//     const keepinData = await keepinResponse.json();
//     if (!keepinData.items || keepinData.items.length === 0) {
//       console.log('Нет товаров для обновления из Keepin.');
//       return;
//     }

//     console.log("Запрашиваем товары из Sitniks...");
//     const sitniksResponse = await fetch(getProductsSitniksURL, { headers: headersSitniks });
//     if (!sitniksResponse.ok) throw new Error(`Ошибка запроса к Sitniks: ${sitniksResponse.status}`);
//     const sitniksData = await sitniksResponse.json();
//     let sitniksProducts = [];
//     if (Array.isArray(sitniksData)) {
//       sitniksProducts = sitniksData;
//     } else if (sitniksData.data && Array.isArray(sitniksData.data)) {
//       sitniksProducts = sitniksData.data;
//     } else {
//       console.error("Структура данных из Sitniks не соответствует ожидаемой");
//       return;
//     }

//     const stockUpdates = keepinData.items.map(product => {
//       let variationId = null;
//       for (let sitniksProduct of sitniksProducts) {
//         if (sitniksProduct.variations && Array.isArray(sitniksProduct.variations)) {
//           const match = sitniksProduct.variations.find(variation => variation.sku === product.sku);
//           if (match) {
//             variationId = match.id;
//             break;
//           }
//         }
//       }
//       if (!variationId) {
//         console.error(`Не найдена вариация для товара с SKU ${product.sku}`);
//         return null;
//       }
//       return {
//         id: variationId,
//         quantity: product.stock_available,
//         warehouseId: warehouseIdSitniks
//       };
//     });

//     const validUpdates = stockUpdates.filter(update => update !== null);
//     console.log("Подготовлены данные для обновления в Sitniks:", validUpdates);
//     if (validUpdates.length === 0) {
//       console.log("Нет корректных данных для обновления.");
//       return;
//     }

//     const updateResponse = await fetch(updateStockSitniksURL, {
//       method: "PUT",
//       headers: headersSitniks,
//       body: JSON.stringify({ productVariations: validUpdates })
//     });
//     if (!updateResponse.ok) {
//       const errorText = await updateResponse.text();
//       throw new Error(`Ошибка обновления остатков в Sitniks: ${updateResponse.status} - ${errorText}`);
//     }
//     console.log("Синхронизация Keepin -> Sitniks успешно выполнена.");
//   } catch (error) {
//     console.error("Ошибка в syncKeepinToSitniks:", error);
//   }
// }

// // Синхронизация из Sitniks в Keepin
// async function syncSitniksToKeepin() {
//   try {
//     console.log("Запрашиваем материалы из Keepin...");
//     const keepinRes = await fetch(getProductsKeepinURL, { headers: headersKeepin });
//     if (!keepinRes.ok) throw new Error(`Ошибка запроса к Keepin: ${keepinRes.status}`);
//     const keepinData = await keepinRes.json();
//     if (!keepinData.items || keepinData.items.length === 0) {
//       console.log("Нет материалов в Keepin для обновления.");
//       return;
//     }

//     console.log("Запрашиваем товары из Sitniks...");
//     const sitniksRes = await fetch(getProductsSitniksURL, { headers: headersSitniks });
//     if (!sitniksRes.ok) throw new Error(`Ошибка запроса к Sitniks: ${sitniksRes.status}`);
//     const sitniksRaw = await sitniksRes.json();

//     let sitniksProducts = [];
//     if (Array.isArray(sitniksRaw)) {
//       sitniksProducts = sitniksRaw;
//     } else if (sitniksRaw.data && Array.isArray(sitniksRaw.data)) {
//       sitniksProducts = sitniksRaw.data;
//     } else {
//       console.error("Структура данных из Sitniks не соответствует ожидаемой");
//       return;
//     }

//     const sitniksBySku = {};
//     sitniksProducts.forEach(prod => {
//       if (prod.variations && Array.isArray(prod.variations)) {
//         prod.variations.forEach(variation => {
//           if (variation.sku) {
//             sitniksBySku[variation.sku] = { product: prod, variation: variation };
//           }
//         });
//       }
//     });

//     for (const material of keepinData.items) {
//       const sku = material.sku;
//       const match = sitniksBySku[sku];
//       if (!match) {
//         console.error(`Не найден товар из Sitniks для SKU ${sku}`);
//         continue;
//       }
//       let newAvailable = material.stock_available;
//       if (
//         match.variation.warehouses &&
//         Array.isArray(match.variation.warehouses) &&
//         match.variation.warehouses.length > 0
//       ) {
//         const warehouseData = match.variation.warehouses[0];
//         newAvailable = warehouseData.availableQuantity !== undefined
//           ? warehouseData.availableQuantity
//           : material.stock_available;
//       }
//       const updateObject = {
//         sku: sku,
//         title: material.title,
//         unit: material.unit || "шт.",
//         price: parseFloat(material.price_amount) || 0,
//         cost: parseFloat(material.cost_amount) || 0,
//         currency: material.currency || "UAH",
//         cost_currency: material.cost_currency || "UAH",
//         weight: match.variation.weight || 0,
//         volume: match.variation.volumeWeight || 0,
//         asset_url: "",
//         link_url: material.link_url || "",
//         category_id: material.marketplace_uid || 0,
//         vat_group_title: "",
//         irrelevant: material.irrelevant,
//         available: newAvailable,
//         stock_rests_attributes: [
//           {
//             office_id: OFFICE_ID,
//             office_hash_id: OFFICE_HASH_ID,
//             office_name: OFFICE_NAME,
//             available: newAvailable
//           }
//         ],
//         custom_fields: [],
//         named_custom_prices: {
//           "Опт": 10,
//           "Інтернет": "12 USD"
//         }
//       };

//       const updateURL = updateMaterialBySkuURL(sku);
//       console.log(`Обновляем материал (SKU ${sku}) в Keepin по URL: ${updateURL}`);
//       const updateRes = await fetch(updateURL, {
//         method: "PUT",
//         headers: headersKeepin,
//         body: JSON.stringify(updateObject)
//       });
//       if (!updateRes.ok) {
//         const errorText = await updateRes.text();
//         console.error(`Ошибка обновления материала с SKU ${sku}: ${updateRes.status} - ${errorText}`);
//       } else {
//         const result = await updateRes.json();
//         console.log(`Материал с SKU ${sku} успешно обновлён:`, result);
//       }
//     }
//   } catch (error) {
//     console.error("Ошибка в syncSitniksToKeepin:", error);
//   }
// }

// // Ручной запуск синхронизации
// app.get('/sync/keepin-to-sitniks', async (req, res) => {
//   await syncKeepinToSitniks();
//   res.json({ status: "syncKeepinToSitniks triggered" });
// });
// app.get('/sync/sitniks-to-keepin', async (req, res) => {
//   await syncSitniksToKeepin();
//   res.json({ status: "syncSitniksToKeepin triggered" });
// });

// // Планировщик: периодическая синхронизация (например, каждые 15 секунд)
// setInterval(syncKeepinToSitniks, 15000);
// setInterval(syncSitniksToKeepin, 15000);

// // Запуск сервера
// app.listen(PORT, () => {
//   console.log(`Интеграционный сервер запущен на порту ${PORT}`);
// });




import express from 'express';
import fetch from 'node-fetch';
import mongoose from 'mongoose';

const app = express();
const PORT = 5001;

// Подключение к MongoDB
mongoose.connect('mongodb+srv://salaryapp5:aM5DtXeMRklFosy5@cluster0.l1wfm.mongodb.net/test?retryWrites=true&w=majority', { 
  useNewUrlParser: true, 
  useUnifiedTopology: true 
})
  .then(() => console.log("MongoDB подключён"))
  .catch(err => console.error("Ошибка подключения к MongoDB:", err));

// Схема для хранения информации об остатках (опционально, если нужна история)
const productStockSchema = new mongoose.Schema({
  sku: { type: String, required: true, unique: true },
  stockQuantity: { type: Number, required: true },
  updatedAt: { type: Date, default: Date.now }
});
const ProductStock = mongoose.model('ProductStock', productStockSchema);

// Схема для логирования операций обновления (опционально)
const stockLogSchema = new mongoose.Schema({
  sku: { type: String, required: true },
  newStock: { type: Number, required: true },
  comment: { type: String, default: "" },
  timestamp: { type: Date, default: Date.now }
});
const StockLog = mongoose.model('StockLog', stockLogSchema);

app.use(express.json());

/* --- Конфигурация API и констант --- */
// Заголовки для KeepinCRM
const headersKeepin = {
  "X-Auth-Token": "XSrcGKCWebJUd7zwndHa57Hx",
  "Content-Type": "application/json"
};

// Заголовки для SitniksCRM
const headersSitniks = {
  "Authorization": "Bearer Dioyg6qqdMhyx5iQz6BU24ZBz83HAIdPIEJ5X51YEvw",
  "Content-Type": "application/json"
};

// URL для KeepinCRM
const getProductsKeepinURL = "https://api.keepincrm.com/v1/materials";
const updateMaterialBySkuURL = (sku) => `https://api.keepincrm.com/v1/materials/sku/${sku}`;

// URL для SitniksCRM
const getProductsSitniksURL = "https://crm.sitniks.com/open-api/products";
const updateStockSitniksURL = "https://crm.sitniks.com/open-api/inventory/quantity";

// Дополнительные параметры
const warehouseIdSitniks = 4505;
const OFFICE_ID = 98279;
const OFFICE_HASH_ID = "hash123";
const OFFICE_NAME = "Main Office";

// --- Механизм блокировки по SKU (in-memory) ---
// Чтобы избежать параллельного обновления одного и того же SKU
const locks = {};
async function acquireLock(key) {
  while (locks[key]) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  locks[key] = true;
}
function releaseLock(key) {
  delete locks[key];
}

/* --- Вспомогательные функции для работы с API --- */

// Получение данных материала из Keepin по SKU
async function getLatestKeepinDataBySku(sku) {
  try {
    const response = await fetch(getProductsKeepinURL, { headers: headersKeepin });
    if (!response.ok) throw new Error(`Ошибка запроса к Keepin: ${response.status}`);
    const data = await response.json();
    if (!data.items || data.items.length === 0) {
      console.error("В Keepin нет материалов");
      return null;
    }
    return data.items.find(item => item.sku === sku) || null;
  } catch (error) {
    console.error("Ошибка в getLatestKeepinDataBySku:", error);
    return null;
  }
}

// Получение ID вариации из Sitniks по SKU
async function getVariationIdBySku(sku) {
  try {
    const response = await fetch(getProductsSitniksURL, { headers: headersSitniks });
    if (!response.ok) throw new Error(`Ошибка запроса к Sitniks: ${response.status}`);
    const data = await response.json();
    const products = Array.isArray(data) ? data : (data.data || []);
    for (let product of products) {
      if (product.variations && Array.isArray(product.variations)) {
        const match = product.variations.find(variation => variation.sku === sku);
        if (match) return match.id;
      }
    }
    return null;
  } catch (error) {
    console.error("Ошибка в getVariationIdBySku:", error);
    return null;
  }
}

// Получение физического остатка (stockQuantity) из Sitniks по variationId
async function getCurrentStockForVariation(variationId) {
  try {
    const response = await fetch(getProductsSitniksURL, { headers: headersSitniks });
    if (!response.ok) throw new Error(`Ошибка получения данных для variationId ${variationId}: ${response.status}`);
    const data = await response.json();
    const products = Array.isArray(data) ? data : (data.data || []);
    for (let product of products) {
      if (product.variations && Array.isArray(product.variations)) {
        const variation = product.variations.find(v => v.id === variationId);
        if (variation) {
          if (variation.warehouses &&
              Array.isArray(variation.warehouses) &&
              variation.warehouses.length > 0 &&
              typeof variation.warehouses[0].stockQuantity !== 'undefined') {
            return variation.warehouses[0].stockQuantity;
          }
          return 0;
        }
      }
    }
    return null;
  } catch (error) {
    console.error("Ошибка в getCurrentStockForVariation:", error);
    return null;
  }
}

/* --- Обработка вебхуков --- */
// Если приходят изменения из Keepin, обновляем Sitniks (это "пуш" обновлений)
app.post('/api/webhook/keepin', async (req, res) => {
  const { material_sku, cost, comment } = req.body;
  console.log("Получен webhook от Keepin:", req.body);

  await acquireLock(material_sku);
  try {
    // Получаем материал из Keepin и берем абсолютное значение остатка
    const latestData = await getLatestKeepinDataBySku(material_sku);
    if (!latestData) return res.status(400).json({ error: "Материал не найден в Keepin" });

    const newAmount = latestData.stock_available;
    const variationId = await getVariationIdBySku(material_sku);
    if (!variationId) {
      console.error(`В Sitniks не найдена вариация для SKU ${material_sku}`);
      return res.status(400).json({ error: "В Sitniks не найдена вариация" });
    }

    const payload = {
      productVariations: [
        {
          id: variationId,
          quantity: newAmount,
          cost: cost,
          comment: comment,
          warehouseId: warehouseIdSitniks
        }
      ]
    };

    console.log(`Обновляем остатки в Sitniks для SKU ${material_sku}:`, payload);
    const response = await fetch(updateStockSitniksURL, {
      method: 'PUT',
      headers: headersSitniks,
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      const errorText = await response.text();
      console.error("Ошибка обновления Sitniks:", errorText);
      return res.status(500).json({ error: "Ошибка обновления в Sitniks" });
    }
    console.log(`Обновление Sitniks для SKU ${material_sku} прошло успешно`);
    res.json({ status: "success" });
  } catch (error) {
    console.error("Ошибка обработки webhook Keepin:", error);
    res.status(500).json({ error: "Внутренняя ошибка сервера" });
  } finally {
    releaseLock(material_sku);
  }
});

/* --- Полный перегон остатков из Sitniks в Keepin --- */
// Этот endpoint производит полный перегон всех остатков из Sitniks в Keepin
// Он опрашивает Sitniks, группирует данные по SKU и для каждого материала получает
// актуальное значение физического остатка, а затем обновляет материал в Keepin.
app.get('/sync/full', async (req, res) => {
  try {
    console.log("Запуск полного переноса остатков из Sitniks в Keepin");

    // Получаем товары из Sitniks
    const sitniksRes = await fetch(getProductsSitniksURL, { headers: headersSitniks });
    if (!sitniksRes.ok) throw new Error(`Ошибка запроса к Sitniks: ${sitniksRes.status}`);
    const sitniksRaw = await sitniksRes.json();
    const sitniksProducts = Array.isArray(sitniksRaw) ? sitniksRaw : (sitniksRaw.data || []);

    // Группируем товары по SKU:
    // Для каждого варианта с заданным SKU получаем stockQuantity (из первого склада)
    const stocksBySku = {};
    sitniksProducts.forEach(product => {
      if (product.variations && Array.isArray(product.variations)) {
        product.variations.forEach(variation => {
          if (variation.sku) {
            // Если в warehouses указан stockQuantity, используем его
            let stock = 0;
            if (variation.warehouses &&
                Array.isArray(variation.warehouses) &&
                variation.warehouses.length > 0 &&
                typeof variation.warehouses[0].stockQuantity !== 'undefined') {
              stock = variation.warehouses[0].stockQuantity;
            }
            stocksBySku[variation.sku] = stock;
          }
        });
      }
    });
    console.log("Найденные остатки по SKU из Sitniks:", stocksBySku);

    // Для каждого SKU из Sitniks обновляем материал в Keepin
    for (const sku in stocksBySku) {
      const newStock = stocksBySku[sku];

      // Получаем актуальные данные материала из Keepin
      const keepinMaterial = await getLatestKeepinDataBySku(sku);
      if (!keepinMaterial) {
        console.error(`Материал с SKU ${sku} не найден в Keepin`);
        continue;
      }

      // Формируем payload согласно схеме Keepin:
      // Обновляем поле available и соответствующий объект stock_rests_attributes
      const updatePayload = {
        sku: sku,
        title: keepinMaterial.title,
        unit: keepinMaterial.unit || "шт.",
        price: parseFloat(keepinMaterial.price_amount) || 0,
        cost: parseFloat(keepinMaterial.cost_amount) || 0,
        currency: keepinMaterial.currency || "UAH",
        cost_currency: keepinMaterial.cost_currency || "UAH",
        weight: keepinMaterial.weight || 0,
        volume: keepinMaterial.volume || 0,
        asset_url: keepinMaterial.asset_url || "",
        link_url: keepinMaterial.link_url || "",
        category_id: keepinMaterial.marketplace_uid || 0,
        vat_group_title: "",
        irrelevant: keepinMaterial.irrelevant || false,
        // Обновляем поле available согласно полученному фактическому остатку из Sitniks
        available: newStock,
        stock_rests_attributes: [
          {
            office_id: OFFICE_ID,
            office_hash_id: OFFICE_HASH_ID,
            office_name: OFFICE_NAME,
            available: newStock
          }
        ],
        custom_fields: [],
        named_custom_prices: {
          "Опт": 10,
          "Інтернет": "12 USD"
        }
      };

      const updateURL = updateMaterialBySkuURL(sku);
      console.log(`Обновляем материал с SKU ${sku} в Keepin. Новый остаток: ${newStock}`);
      try {
        const updateRes = await fetch(updateURL, {
          method: "PUT",
          headers: headersKeepin,
          body: JSON.stringify(updatePayload)
        });
        if (!updateRes.ok) {
          const errorText = await updateRes.text();
          console.error(`Ошибка обновления материала для SKU ${sku}: ${updateRes.status} - ${errorText}`);
        } else {
          const result = await updateRes.json();
          console.log(`Успешное обновление материала для SKU ${sku}:`, result);

          // (Необязательно) Логирование операции в БД
          const logEntry = new StockLog({
            sku,
            newStock,
            comment: "Полный перегон остатков из Sitniks в Keepin"
          });
          await logEntry.save();

          // (Необязательно) Обновляем запись о текущем остатке в БД
          let stockRecord = await ProductStock.findOne({ sku });
          if (!stockRecord) {
            stockRecord = new ProductStock({ sku, stockQuantity: newStock });
          } else {
            stockRecord.stockQuantity = newStock;
            stockRecord.updatedAt = new Date();
          }
          await stockRecord.save();
        }
      } catch (error) {
        console.error(`Ошибка отправки обновления для SKU ${sku}:`, error);
      }
    }
    res.json({ status: "success", message: "Полный перегон остатков завершён" });
  } catch (error) {
    console.error("Ошибка в полном перегоне остатков:", error);
    res.status(500).json({ error: "Ошибка полного переноса остатков" });
  }
});

// Запуск сервера
app.listen(PORT, () => {
  console.log(`Интеграционный сервер запущен на порту ${PORT}`);
});
