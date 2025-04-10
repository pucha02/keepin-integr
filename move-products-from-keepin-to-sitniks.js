const headersKeepin = {
  "X-Auth-Token": "XSrcGKCWebJUd7zwndHa57Hx"
};

const headersSitniks = {
  "Authorization": "Bearer Dioyg6qqdMhyx5iQz6BU24ZBz83HAIdPIEJ5X51YEvw",
  "Content-Type": "application/json"
};

const getProductsKeepinURL = "https://api.keepincrm.com/v1/materials";
const postProductsSitniksURL = "https://crm.sitniks.com/open-api/products";

console.log("Отправляем запрос к Keepin с заголовками:", headersKeepin);

fetch("https://crm.sitniks.com/open-api/products/categories", {
  method: "GET",
  headers: headersSitniks,

})
  .then(response => {
    if (!response.ok) {
      return response.text().then(text => {
        throw new Error(`Ошибка при создании товара в Sitniks: ${response.status} - ${text}`);
      });
    }
    return response.json();
  })
  .then(result => {
    console.log("Категории:", result);
  })
  .catch(error => {
    console.error("Ошибка при создании товара в Sitniks:", error);
  });

fetch(getProductsKeepinURL, {
  method: "GET",
  headers: headersKeepin
})
  .then(response => {
    if (!response.ok) {
      throw new Error(`Ошибка HTTP: ${response.status}`);
    }
    return response.json();
  })
  .then(data => {
    console.log("Успешный ответ от Keepin:", data);

    data.items.forEach(product => {
      // Маппинг полей из Keepin в структуру Sitniks (новый формат)
      const sitniksProduct = {
        title: product.title,
        titleLang: {
          uk: product.title,
          ru: product.title,
          en: product.title
        },
        categoryId: 63523, // можно скорректировать в зависимости от требований
        description: product.title,
        descriptionLang: {
          uk: product.title,
          ru: product.title,
          en: product.title
        },
        auxiliaryInfo: {},
        variations: [
          {
            title: product.title,
            sku: product.sku,
            barcode: "", // если есть штрихкод, можно его подставить
            price: parseFloat(product.price_amount),
            costPrice: parseFloat(product.cost_amount),
            weight: product.weight || 0,
            volumeWeight: product.volume || 0,
            height: 0,
            width: 0,
            depth: 0,
            properties: [],
            attachments: product.link_url ? [{ url: product.link_url }] : [],
            auxiliaryInfo: {}
          }
        ]
      };

      // Отправляем POST-запрос для создания товара в Sitniks
      fetch(postProductsSitniksURL, {
        method: "POST",
        headers: headersSitniks,
        body: JSON.stringify(sitniksProduct)
      })
        .then(response => {
          if (!response.ok) {
            return response.text().then(text => {
              throw new Error(`Ошибка при создании товара в Sitniks: ${response.status} - ${text}`);
            });
          }
          return response.json();
        })
        .then(result => {
          console.log("Товар успешно создан в Sitniks:", result);
        })
        .catch(error => {
          console.error("Ошибка при создании товара в Sitniks:", error);
        });
    });
  })
  .catch(error => {
    console.error("Ошибка запроса к Keepin:", error);
  });
