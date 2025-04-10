const headersKeepin = {
    "X-Auth-Token": "XSrcGKCWebJUd7zwndHa57Hx"
  };
  
  const headersSitniks = {
    "Authorization": "Bearer Dioyg6qqdMhyx5iQz6BU24ZBz83HAIdPIEJ5X51YEvw",
    "Content-Type": "application/json"
  };
  
  const getProductsKeepinURL = "https://api.keepincrm.com/v1/materials";
  // Обратите внимание на URL для получения товаров из Sitniks
  const getProductsSitniksURL = "https://crm.sitniks.com/open-api/products";
  const updateStockSitniksURL = "https://crm.sitniks.com/open-api/inventory/quantity";
  
  // Укажите корректное значение warehouseId
  const warehouseId = 63523;
  
  async function updateStockFromKeepin() {
    try {
      console.log("Запрашиваем товары из Keepin...");
      const keepinResponse = await fetch(getProductsKeepinURL, { headers: headersKeepin });
      if (!keepinResponse.ok) {
        throw new Error(`Ошибка запроса к Keepin: ${keepinResponse.status}`);
      }
      const keepinData = await keepinResponse.json();
      console.log("Получены данные из Keepin:", keepinData);
  
      if (!keepinData.items || keepinData.items.length === 0) {
        console.log("Нет товаров из Keepin для обновления.");
        return;
      }
  
      console.log("Запрашиваем товары из Sitniks...");
      const sitniksResponse = await fetch(getProductsSitniksURL, { headers: headersSitniks });
      if (!sitniksResponse.ok) {
        throw new Error(`Ошибка запроса к Sitniks: ${sitniksResponse.status}`);
      }
      const sitniksData = await sitniksResponse.json();
      console.log("Получены товары из Sitniks:", sitniksData);

      const sitniksResponsew = await fetch("https://crm.sitniks.com/open-api/warehouses", { headers: headersSitniks });
      if (!sitniksResponse.ok) {
        throw new Error(`Ошибка запроса к Sitniks: ${sitniksResponsew.status}`);
      }
      const sitniksDataw = await sitniksResponsew.json();
      console.log("Получены Склады из Sitniks:", sitniksDataw);
  
      // Если ответ в Sitniks находится в поле data, используем его
      let sitniksProducts = [];
      if (Array.isArray(sitniksData)) {
        sitniksProducts = sitniksData;
      } else if (sitniksData.data && Array.isArray(sitniksData.data)) {
        sitniksProducts = sitniksData.data;
      } else {
        console.error("Структура данных из Sitniks не соответствует ожидаемой");
        return;
      }
  
      // Формируем массив обновлений остатков
      const stockUpdates = keepinData.items.map(product => {
        let variationId = null;
  
        // Ищем товар в массиве Sitniks по совпадению title или sku
        for (let sitniksProduct of sitniksProducts) {
          if (sitniksProduct.variations && Array.isArray(sitniksProduct.variations)) {
            // Если нужно сравнивать по SKU, проверяем наличие поля sku в вариациях
            const match = sitniksProduct.variations.find(variation => variation.sku === product.sku);
            if (match) {
              variationId = match.id;
              break;
            }
          }
        }
  
        if (!variationId) {
          console.error(`Не найдена вариация для товара с SKU ${product.sku}`);
          return null;
        }
  
        return {
          id: variationId,
          quantity: product.stock_available,
          warehouseId: 4505
        };
      });
  
      // Фильтруем корректные данные
      const validUpdates = stockUpdates.filter(update => update !== null);
      console.log("Подготовлены данные для обновления остатков:", validUpdates);
  
      if (validUpdates.length === 0) {
        console.log("Нет корректных данных для обновления остатков.");
        return;
      }
  
      // Отправляем POST-запрос для обновления остатков
      const updateResponse = await fetch(updateStockSitniksURL, {
        method: "PUT",
        headers: headersSitniks,
        body: JSON.stringify({ productVariations: validUpdates })
      });
  
      if (!updateResponse.ok) {
        const errorText = await updateResponse.text();
        throw new Error(`Ошибка обновления остатков в Sitniks: ${updateResponse.status} - ${errorText}`);
      }
  
      console.log("Остатки успешно обновлены в Sitniks.");
    } catch (error) {
      console.error("Ошибка при обновлении остатков:", error);
    }
  }
  
  updateStockFromKeepin();
  