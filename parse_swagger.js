const fs = require('fs');
const path = require('path');

// 1. Read Swagger JSON
const swaggerPath = path.resolve(__dirname, 'swagger.json');
let swagger = {};
if (fs.existsSync(swaggerPath)) {
  swagger = JSON.parse(fs.readFileSync(swaggerPath, 'utf8'));
}

const apiList = {};
const apiDetailed = {};

if (swagger.paths) {
  for (const [routePath, methods] of Object.entries(swagger.paths)) {
    for (const [method, details] of Object.entries(methods)) {
      const tags = details.tags || ['Uncategorized'];
      const tag = tags[0];

      if (!apiList[tag]) {
        apiList[tag] = [];
        apiDetailed[tag] = [];
      }

      apiList[tag].push({
        path: routePath,
        method: method.toUpperCase(),
        summary: details.summary || '',
        description: details.description || '',
        operationId: details.operationId || ''
      });

      apiDetailed[tag].push({
        path: routePath,
        method: method.toUpperCase(),
        summary: details.summary || '',
        description: details.description || '',
        operationId: details.operationId || '',
        parameters: details.parameters || [],
        requestBody: details.requestBody || null,
        responses: details.responses || {},
        security: details.security || []
      });
    }
  }
}

// 2. Read Postman Collection if available to merge extra endpoints
const postmanPath = path.resolve(__dirname, 'postman_collection.json');
if (fs.existsSync(postmanPath)) {
  try {
    const postman = JSON.parse(fs.readFileSync(postmanPath, 'utf8'));
    function parsePostmanItems(items, currentTag = 'Postman Collection') {
      for (const item of items) {
        if (item.item && Array.isArray(item.item)) {
          parsePostmanItems(item.item, item.name || currentTag);
        } else if (item.request) {
          const method = (item.request.method || 'GET').toUpperCase();
          const rawUrl = typeof item.request.url === 'string' 
            ? item.request.url 
            : (item.request.url?.raw || '');
          
          let parsedPath = rawUrl;
          try {
            const urlObj = new URL(rawUrl.replace(/\{\{[^}]+\}\}/g, 'https://placeholder.domain'));
            parsedPath = urlObj.pathname;
          } catch (e) {
            parsedPath = rawUrl.replace(/^.*?execute-api[^\/]+/, '');
          }

          if (!apiList[currentTag]) {
            apiList[currentTag] = [];
            apiDetailed[currentTag] = [];
          }

          const exists = apiList[currentTag].some(e => e.path === parsedPath && e.method === method);
          if (!exists) {
            apiList[currentTag].push({
              path: parsedPath,
              method,
              summary: item.name || '',
              description: item.request.description || '',
              operationId: item.name?.replace(/\s+/g, '_') || ''
            });

            apiDetailed[currentTag].push({
              path: parsedPath,
              method,
              summary: item.name || '',
              description: item.request.description || '',
              operationId: item.name?.replace(/\s+/g, '_') || '',
              requestBody: item.request.body || null,
              headers: item.request.header || []
            });
          }
        }
      }
    }

    if (postman.item) {
      parsePostmanItems(postman.item);
    }
  } catch (err) {
    console.warn('⚠️ Warning: Could not merge postman collection:', err.message);
  }
}

fs.writeFileSync('api_list.json', JSON.stringify(apiList, null, 2));
fs.writeFileSync('api_detailed.json', JSON.stringify(apiDetailed, null, 2));

console.log('✅ Successfully extracted API list to api_list.json');
console.log('✅ Successfully extracted detailed API specs to api_detailed.json');
console.log(`📊 Discovered ${Object.keys(apiList).length} Categories / Domains:`);
for (const [tag, items] of Object.entries(apiList)) {
  console.log(`   - ${tag}: ${items.length} endpoint(s)`);
}

