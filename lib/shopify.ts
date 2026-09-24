// lib/shopify.ts

const SHOP = process.env.SHOPIFY_STORE_DOMAIN!;
const CLIENT_ID = process.env.SHOPIFY_CLIENT_ID!;
const CLIENT_SECRET = process.env.SHOPIFY_CLIENT_SECRET!;

let cachedToken: string | null = null;
let tokenExpiresAt = 0;

async function getAccessToken(): Promise<string> {
  // Reuse the cached token if it's still valid (with a 60s safety buffer)
  if (cachedToken && Date.now() < tokenExpiresAt - 60_000) {
    return cachedToken;
  }

  const response = await fetch(`https://${SHOP}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Shopify token exchange failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  cachedToken = data.access_token;
  tokenExpiresAt = Date.now() + data.expires_in * 1000; // expires_in is ~86399 seconds

  return cachedToken!;
}

export async function shopifyAdminRequest<T = any>(
  query: string,
  variables?: Record<string, any>
): Promise<T> {
  const token = await getAccessToken();

  const response = await fetch(
    `https://${SHOP}/admin/api/2026-01/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": token,
      },
      body: JSON.stringify({ query, variables }),
    }
  );

  const result = await response.json();

  if (result.errors) {
    throw new Error(`Shopify GraphQL error: ${JSON.stringify(result.errors)}`);
  }

  return result.data;
}

export async function getProducts() {
  const data = await shopifyAdminRequest(`
    query {
      products(first: 20) {
        edges {
          node {
            id
            title
            handle
            featuredImage {
              url
              altText
            }
            variants(first: 25) {
              edges {
                node {
                  id
                  title
                  price
                  selectedOptions {
                    name
                    value
                  }
                  image {
                    url
                  }
                }
              }
            }
          }
        }
      }
    }
  `);

  return data.products.edges.map((edge: any) => edge.node);
}
export async function deleteProduct(id: string) {
  return shopifyAdminRequest(`
    mutation {
      productDelete(input: { id: "${id}" }) {
        deletedProductId
      }
    }
  `);
}

export async function createProduct(input: {
  title: string;
  productType: string;
  imageUrl: string;
  variants: { size: string; color: string; price: string }[];
}) {
  const data = await shopifyAdminRequest(`
    mutation {
      productCreate(product: {
        title: "${input.title}"
        productType: "${input.productType}"
        status: ACTIVE
      }) {
        product { id }
        userErrors { field message }
      }
    }
  `);
  return data.productCreate.product;
}
export async function addProductImage(productId: string, imageUrl: string, altText: string) {
  const data = await shopifyAdminRequest(`
    mutation {
      productCreateMedia(
        productId: "${productId}"
        media: [{
          originalSource: "${imageUrl}"
          alt: "${altText}"
          mediaContentType: IMAGE
        }]
      ) {
        media { alt }
        mediaUserErrors { field message }
      }
    }
  `);
  return data.productCreateMedia;
}
export async function getProduct(id: string) {
  const data = await shopifyAdminRequest(`
    query {
      product(id: "${id}") {
        id
        title
        featuredImage {
          url
        }
      }
    }
  `);
  return data.product;
}
export async function createStagedUpload(filename: string, mimeType: string, fileSize: string) {
  const data = await shopifyAdminRequest(`
    mutation {
      stagedUploadsCreate(input: [{
        resource: FILE
        filename: "${filename}"
        mimeType: "${mimeType}"
        fileSize: "${fileSize}"
        httpMethod: POST
      }]) {
        stagedTargets {
          url
          resourceUrl
          parameters { name value }
        }
        userErrors { field message }
      }
    }
  `);
  return data.stagedUploadsCreate.stagedTargets[0];
}

export async function createFileFromStagedUpload(resourceUrl: string, alt: string) {
  const data = await shopifyAdminRequest(`
    mutation {
      fileCreate(files: [{
        originalSource: "${resourceUrl}"
        alt: "${alt}"
        contentType: IMAGE
      }]) {
        files { id }
        userErrors { field message }
      }
    }
  `);
  return data.fileCreate.files[0];
}

export async function getFileStatus(fileId: string) {
  const data = await shopifyAdminRequest(`
    query($id: ID!) {
      node(id: $id) {
        ... on MediaImage {
          image { url }
        }
      }
    }
  `, { id: fileId });
  return data.node;
}
export async function createDesignMetaobjectDefinition() {
  const data = await shopifyAdminRequest(`
    mutation {
      metaobjectDefinitionCreate(definition: {
        type: "custom_design"
        name: "Custom Design"
        fieldDefinitions: [
          { key: "design_json", name: "Design JSON", type: "json" }
          { key: "product_id", name: "Product ID", type: "single_line_text_field" }
          { key: "locked", name: "Locked", type: "boolean" }
        ]
      }) {
        metaobjectDefinition { id }
        userErrors { field message }
      }
    }
  `);
  return data.metaobjectDefinitionCreate;
}

export async function saveDesign(designId: string | null, productId: string, designJson: object) {
  if (designId) {
    const data = await shopifyAdminRequest(`
      mutation($id: ID!, $json: String!) {
        metaobjectUpdate(id: $id, metaobject: { fields: [{ key: "design_json", value: $json }] }) {
          metaobject { id }
          userErrors { field message }
        }
      }
    `, { id: designId, json: JSON.stringify(designJson) });
    return data.metaobjectUpdate.metaobject;
  }

  const data = await shopifyAdminRequest(`
    mutation($productId: String!, $json: String!) {
      metaobjectCreate(metaobject: {
        type: "custom_design"
        fields: [
          { key: "design_json", value: $json }
          { key: "product_id", value: $productId }
          { key: "locked", value: "false" }
        ]
      }) {
        metaobject { id }
        userErrors { field message }
      }
    }
  `, { productId, json: JSON.stringify(designJson) });
  return data.metaobjectCreate.metaobject;
}

export async function getDesign(designId: string) {
  const data = await shopifyAdminRequest(`
    query($id: ID!) {
      metaobject(id: $id) {
        id
        fields { key value }
      }
    }
  `, { id: designId });
  return data.metaobject;
}
export async function findDesignByProduct(productId: string) {
  const data = await shopifyAdminRequest(`
    query($query: String!) {
      metaobjects(type: "custom_design", first: 1, query: $query) {
        edges {
          node {
            id
            fields { key value }
          }
        }
      }
    }
  `, { query: `product_id:${productId}` });
  return data.metaobjects.edges[0]?.node ?? null;
}
export async function createStorefrontToken() {
  const data = await shopifyAdminRequest(`
    mutation {
      storefrontAccessTokenCreate(input: { title: "Nova Edge Design Tool" }) {
        storefrontAccessToken { accessToken }
        userErrors { field message }
      }
    }
  `);
  return data.storefrontAccessTokenCreate;
}