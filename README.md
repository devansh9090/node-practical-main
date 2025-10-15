# 🎯 Inventory Order Flow Management — Task (API creation with order item status logics)

# 🎯 Project Overview

* The project is a rental management system consisting of separate user and admin panels. Admins are responsible for adding inventories, each identified with a unique barcode, which are displayed to users as artworks. Users can create multiple orders with defined pickup and return dates, and add inventories to these orders similar to a cart functionality, ensuring no duplicate inventories exist within the same order. Once users finalize their selections, they can request a hold for that order. The system allows a maximum of three hold requests for the same inventory across conflicting dates; any further requests mark the inventory as unavailable. Admins then review and confirm orders based on a first-come, first-served approach. When an order is confirmed, all inventories under that order become unavailable to other users until the order’s return date.  
    
* After a user requests a hold on an order, the admin reviews and approves the items individually. Only items with hold-request statuses can be approved: on-hold-request items become on-hold, second-hold-request items become second-hold, and third-hold-request items become third-hold. Items with any other status are not eligible for approval.

---

## ✅ Task Scope & Requirements
- [ ] Use provided sample JSON data (inventories, users, orders, order items)
- [ ] Implement status management logic for these APIs:
  - [ ] **/request-hold** – Update inventory statuses on user hold requests; respect conflicts and hold limits
  - [ ] **/remove-order-item** – Recalculate statuses when an inventory is removed; update conflicting orders
  - [ ] **/update-order** – Update statuses when admin changes pickup/return dates; prevent conflicts with confirmed orders
  - [ ] **/confirm-order** – Validate availability and conflicts before confirming; update statuses of all affected inventories

---

## ✅ Acceptance Criteria
- [ ] All four API flows (/request-hold, /remove-order-item, /update-order, /confirm-order) implemented correctly
- [ ] Order item and order statuses update accurately based on conflicts
- [ ] Order update API prevents modification when conflicts exist with confirmed orders
- [ ] Order confirmation validates availability and conflicts before finalizing
- [ ] Removing an order item correctly updates or restores related statuses in other orders
- [ ] Conflict detection and status recalculation logic is modular, reusable, and tested
- [ ] Code follows folder naming conventions, file length limit, and structure rules
- [ ] Adequate error handling and logging added for debugging

---

## ✅ Logic Explanation

- Kindly refer to the document below for a detailed overview of the entire flow:-
https://docs.google.com/document/d/1C7XjAHh8AFRGZK0oTMLH39sI-DP4wH2O1h_GzoT8Ppw/edit?tab=t.0#heading=h.fjuo4qdbw3kr

---

## 🚀 Delivery
- [ ] Create a **private GitHub repo** and share access with: **pratik@saeculumsolutions.com**, **malhar.prajapati@saeculumsolutions.com**
- [ ] Or create a **public repo** and share the URL


---


## 🛠️ Project Setup

### **Prerequisites**
- **Node.js**: Version 18.x or higher (recommended: 18.17.0+)
- **npm**: Version 9.x or higher
- **Git**: For version control

### **Getting Started**

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Start Development Server**
   ```bash
   npm start
   ```

3. **Build for Production**
   ```bash
   npm run build
   ```
---

### **Project Structure**
```
node-practical/
├── src/
│   ├── controllers/      # Contains folders for logical part of each module
│   └── helper/           # Contains logic for add order item status flow
│   ├── json-data/        # Contains sample data of order, order item, user, inventory
│   └── routes/           # Contains route of all module
│   └── schemas/          # Contains schema of all module
├── index.js             # Main starting point
├── package.json         # Dependencies and scripts
```

### **Available Scripts**
- `npm start` - Start development server
- `npm run build` - Build for production
  
---
