# Shopify Insights Dashboard

This project is a multi-tenant Shopify Data Ingestion & Insights Service. The application allows users to securely connect their Shopify store, ingest their core business data, and visualize key performance indicators on a polished, interactive dashboard.

### **Live Demo**

**https://xeno-fde-assignment.vercel.app/**

<img width="1800" height="865" alt="image" src="https://github.com/user-attachments/assets/84a7918e-997b-4d2f-8313-20ee5e406af0" />  
<img width="1800" height="865" alt="image" src="https://github.com/user-attachments/assets/cb50d431-ae0f-4e35-b023-86b115b83a74" />
<img width="1800" height="865" alt="image" src="https://github.com/user-attachments/assets/55b2c74e-4dbf-4059-a3a6-c8c9252c66c0" />




### **Features**

* **Secure User Authentication:** Seamless and secure user sign-up and login flow powered by Clerk, including social sign-on with Google.
* **Real-Time Data Ingestion:** Utilizes Shopify Webhooks for \`orders/create\` events to ensure the dashboard reflects new orders in real-time.
* **Historical Data Sync:** An on-demand manual sync feature to pull the latest 100 customers and orders, allowing users to refresh their data at any time.
* **Multi-Tenant Architecture:** A secure, multi-tenant design that strictly isolates data between different stores using a \`storeId\` foreign key on all relevant database models and enforced at the API level.
* **Interactive Insights Dashboard:** A polished and responsive dashboard featuring:
    * Key Performance Indicators (Total Revenue, Orders, Customers).
    * An interactive Sales Performance chart with date-range filtering.
    * A list of the Top 5 Customers by total spend.
    * A list of the Top 5 Orders by spend.
    * A drill-down modal to view the order history for a specific customer.
    * A bar chart showing average revenue according to date.

### **Tech Stack**

* **Framework: Next.js (App Router)** - For its powerful full-stack capabilities in a single codebase.
* **Language: TypeScript** - To ensure type safety and long-term maintainability.
* **Authentication: Clerk** - For a complete, production-ready user management solution.
* **Database: Supabase (PostgreSQL)** - For a robust and scalable managed SQL database.
* **ORM: Prisma** - For its best-in-class TypeScript support and type-safe database client.
* **UI: React, Tailwind CSS** - For building a modern and responsive user interface efficiently.
* **Charting: Recharts** - For its simplicity in creating interactive and declarative charts.
* **Deployment: Vercel** - For its seamless, Git-based integration with Next.js.

### **Architecture Diagram**

This diagram illustrates the flow of data and user interactions within the system.

<img width="963" height="634" alt="image" src="https://github.com/user-attachments/assets/8d86b240-1b77-4c8e-a6af-bb1d16537e26" />


### **Database Schema**

The schema is designed for multi-tenancy, linking all store-specific data back to a \`Store\` and a \`User\`.

<img width="963" height="637" alt="image" src="https://github.com/user-attachments/assets/c7167c7f-6a54-478e-a85f-8ac07db74694" />


### **API Endpoints**

All API endpoints are protected and require an authenticated session.

| **Endpoint** | **Method** | **Description** |
| ------------------------------ | ---------- | ------------------------------------------------------------ |
| \`/api/auth/shopify\`            | \`GET\`    | Initiates the Shopify OAuth2 flow.                           |
| \`/api/auth/callback/shopify\`   | \`GET\`    | Handles the OAuth callback and saves the store.              |
| \`/api/webhooks/orders-create\`  | \`POST\`   | Receives real-time order webhooks from Shopify.              |
| \`/api/sync\`                    | \`POST\`   | Triggers a manual historical data sync.                      |
| \`/api/stores\`                  | \`GET\`    | **(Secure)** Returns stores connected by the current user.   |
| \`/api/insights/*\`              | \`GET\`    | **(Secure)** Fetches various aggregated insights for the dashboard. |

### **Local Setup Instructions**

1.   **Clone the repository**
       ```bash
       git clone https://github.com/HarishKumaarD/Xeno_FDE_Assignment.git
       cd xeno-shopify-app
       npm install 
       ```

2.  **Set up .env :**
    Create the file and add your credentials for Supabase, Shopify, and Clerk.

3.  **Run Database Migrations:**

       ```bash
       npx prisma migrate dev 
       ```

4.  **Run Development Server:**

    ```bash
    npm run dev
    ```

### **Known Limitations & Assumptions**

* **Historical Sync Batch Size:** The manual sync fetches the latest 100 records. For larger stores, this would be re-architected as a paginated background job.
* **Single Webhook:** The application currently only registers a webhook for \`orders/create\`. A production system would also subscribe to update and delete events for all relevant models.

### **Future Improvements**

* **Robust Background Jobs:** For the historical sync, migrate from a single serverless function to a dedicated queue system (e.g., RabbitMQ, BullMQ). This would allow for robust, paginated fetching of all historical data without timeouts, and would provide better error handling and retry mechanisms.
* **Comprehensive Webhook Coverage:** Expand the webhook integration to subscribe to \`update\` and \`delete\` events for all core models (Orders, Products, Customers). This would ensure the data in our system remains a perfect mirror of the Shopify store over time.
* **Advanced Caching & Analytics:** For larger datasets, dashboard queries could become slow. I would implement a caching layer (e.g., Redis) for frequently accessed data. Additionally, I would build a pre-aggregation system (e.g., a nightly cron job) to compute key metrics in advance, making the dashboard load instantly.
* **Enhanced Monitoring & Error Handling:** Integrate a third-party logging and error monitoring service (like Sentry or Logtail). This would provide real-time alerts for API errors and webhook failures, allowing for proactive debugging. I would also add a UI for the user to see the status of their data syncs.
* **Multi-Store UI:** The current UI is designed for a user with a single store. The next iteration would include a store-switcher component in the UI, allowing users who own multiple Shopify stores to easily navigate between their respective dashboards.
EOF
