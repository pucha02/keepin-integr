import fetch from "node-fetch";

// Заголовки для Keepin
const headersKeepin = {
  "X-Auth-Token": "XSrcGKCWebJUd7zwndHa57Hx",
  "Content-Type": "application/json"
};

// Заголовки для Sitniks
const headersSitniks = {
  "Authorization": "Bearer Dioyg6qqdMhyx5iQz6BU24ZBz83HAIdPIEJ5X51YEvw"
};

// URL'ы
const getProductsKeepinURL = "https://api.keepincrm.com/v1/materials";
const getProductsSitniksURL = "https://crm.sitniks.com/open-api/products";
// Эндпоинт обновления материала по SKU
const updateMaterialBySkuURL = (sku) => `https://api.keepincrm.com/v1/materials/sku/${sku}`;

// Данные офиса
const OFFICE_ID = 98279;
const OFFICE_HASH_ID = "hash123";
const OFFICE_NAME = "Main Office";

async function updateMaterialsInKeepin() {
  try {
    console.log("Запрашиваем материалы из Keepin...");
    const keepinRes = await fetch(getProductsKeepinURL, { headers: headersKeepin });
    if (!keepinRes.ok) throw new Error(`Ошибка запроса к Keepin: ${keepinRes.status}`);
    const keepinData = await keepinRes.json();

    if (!keepinData.items || keepinData.items.length === 0) {
      console.log("Нет материалов для обновления в Keepin.");
      return;
    }

    console.log("Запрашиваем товары из Sitniks...");
    const sitniksRes = await fetch(getProductsSitniksURL, { headers: headersSitniks });
    if (!sitniksRes.ok) throw new Error(`Ошибка запроса к Sitniks: ${sitniksRes.status}`);
    const sitniksRaw = await sitniksRes.json();

    let sitniksProducts = [];
    if (Array.isArray(sitniksRaw)) {
      sitniksProducts = sitniksRaw;
    } else if (sitniksRaw.data && Array.isArray(sitniksRaw.data)) {
      sitniksProducts = sitniksRaw.data;
    } else {
      console.error("Структура данных из Sitniks не соответствует ожидаемой");
      return;
    }

    // Создаём словарь товаров из Sitniks по SKU
    const sitniksBySku = {};
    sitniksProducts.forEach(prod => {
      if (prod.variations && Array.isArray(prod.variations)) {
        prod.variations.forEach(variation => {
          if (variation.sku) {
            if (!sitniksBySku[variation.sku]) {
              sitniksBySku[variation.sku] = { product: prod, variation: variation };
            }
          }
        });
      }
    });

    // Обновляем каждый материал, если есть соответствие по SKU
    for (const material of keepinData.items) {
      const sku = material.sku;
      const sitniksMatch = sitniksBySku[sku];

      if (!sitniksMatch) {
        console.error(`Не найден товар из Sitniks для SKU ${sku}`);
        continue;
      }

      // Получаем остаток со склада из данных Sitniks, если он есть
      let newAvailable = material.stock_available;
      if (
        sitniksMatch.variation.warehouses &&
        Array.isArray(sitniksMatch.variation.warehouses) &&
        sitniksMatch.variation.warehouses.length > 0
      ) {
        const warehouseData = sitniksMatch.variation.warehouses[0];
        newAvailable = warehouseData.availableQuantity !== undefined
          ? warehouseData.availableQuantity
          : material.stock_available;
      }

      // Формируем объект для обновления
      const updateObject = {
        sku: sku,
        title: material.title,
        unit: material.unit || "шт.",
        price: parseFloat(material.price_amount) || 0,
        cost: parseFloat(material.cost_amount) || 0,
        currency: material.currency || "UAH",
        cost_currency: material.cost_currency || "UAH",
        weight: sitniksMatch.variation.weight || 0,
        volume: sitniksMatch.variation.volumeWeight || 0,
        asset_url: "",
        link_url: material.link_url || "",
        category_id: material.marketplace_uid || 0,
        vat_group_title: "",
        irrelevant: material.irrelevant,
        available: newAvailable,
        stock_rests_attributes: [
          {
            office_id: OFFICE_ID,
            office_hash_id: OFFICE_HASH_ID,
            office_name: OFFICE_NAME,
            available: newAvailable
          }
        ],
        custom_fields: [],
        named_custom_prices: {
          "Опт": 10,
          "Інтернет": "12 USD"
        }
      };

      const updateURL = updateMaterialBySkuURL(sku);
      console.log(`Обновляем материал (SKU ${sku}) по URL: ${updateURL}`, updateObject);

      const updateRes = await fetch(updateURL, {
        method: "PUT",
        headers: headersKeepin,
        body: JSON.stringify(updateObject)
      });

      if (!updateRes.ok) {
        const errorText = await updateRes.text();
        console.error(`Ошибка обновления материала с SKU ${sku}: ${updateRes.status} - ${errorText}`);
      } else {
        const result = await updateRes.json();
        console.log(`Успешно обновлён материал с SKU ${sku}:`, result);
      }
    }
  } catch (error) {
    console.error("Ошибка при обновлении материалов в Keepin:", error);
  }
}

// Запускаем обновление каждые 10 секунд
setInterval(updateMaterialsInKeepin, 10000);

// Также можно выполнить обновление сразу при запуске
updateMaterialsInKeepin();
