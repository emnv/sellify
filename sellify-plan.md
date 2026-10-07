# **Sellify Paid Trial Brief: Storefront Builder**
## **About Sellify and this trial**

Sellify is a point-of-sale platform for phone repair and resale shops. Shop owners use it to sell phones and accessories, log repair jobs, and buy phones from customers (buyback). It already holds each shop's inventory, repair prices and buyback prices.

The trial has one goal: to see your full ability, from design and frontend to backend, security and communication. We will judge the quality of what works, not the amount you start. AI tools are welcome. We care about how well you check and understand what they produce.

## **The task in one paragraph**

Build **Sellify Stores**: a feature that lets any shop owner publish their own online store from inside Sellify, in a few clicks. The store has three tabs, **Shop**, **Repair** and **Sell**, all connected live to the shop's Sellify data. The owner can edit how it looks, pick a template or use an AI customizer, and connect their own domain, much like Shopify. You will then use the feature yourself to **create and publish a real demo store** with its own brand.

There are **two separate brand guidelines** in this trial:

1. **Part 1: Sellify platform brand guideline.** For the Sellify backend that shop owners log into. Based on our existing Sellify Market branding.  
2. **Part 2: Sellify Stores, plus a demo store brand guideline.** You build the store feature using the Sellify guideline, then create a different brand for a made-up shop and publish its store.

## **Part 1: Sellify platform brand guideline**

**The problem today:** every new page in Sellify is designed from scratch. Filter pills are different sizes on different pages, buttons don't match, and spacing and colours vary. There is no consistent brand.

**What we want:** one set of design rules that every page follows, now and in the future.

**Where to start:** visit [sellify.market](https://www.sellify.market) and take the logo, colours and overall feel as your starting point. Build the guideline from that, so the backend matches the Sellify brand customers already see.

**Where it applies:** the Sellify backend that shop owners log into, including the new store settings screens in Part 2\. It does **not** apply to the public stores shops publish. Those get their own brand (see 2.9).

### **What to deliver**

1. **A written brand guideline**, short and clear, covering:  
   * Colours, with exact codes (e.g. primary `#1A73E8`, success, warning, error, backgrounds, text)  
   * Fonts and text sizes (page title, section heading, body, small print)  
   * Spacing, corner rounding and shadows  
   * Layout rules: page width, sidebar, how a standard page is laid out  
   * Logo use and tone of voice for buttons and messages  
2. **Shared components in code** that enforce the guideline. At least: button, pill/tag, filter bar, input, dropdown, table, card, modal, status badge, page header. Every page should use these, not its own versions.  
3. **Every existing page updated** to use the shared components.  
4. **A rules file for AI coding tools** (for example a `CLAUDE.md`) telling any AI that builds a new page to use these components and colours. Future pages should come out consistent automatically.

### **How we will check it**

We will open five random pages. Every filter pill should be the same size, every primary button the same colour and shape, and spacing should match. If only the pages you worked on look right, Part 1 isn't done.

## **Part 2: Sellify Stores**

The examples below follow one made-up shop: **Mary owns "FixIt Galway"** and already uses Sellify for her stock, repairs and buybacks. Her customer is **John**.

### **2.1 Publish a store**

A shop owner turns on an online store from their Sellify backend. No coding, no separate website builder.

**Example:** Mary logs into Sellify and clicks **Online Store** in the sidebar. She types her store name, "FixIt Galway", uploads her logo and clicks **Publish**. Within a minute her store is live at `fixitgalway.sellify.market`. She can switch it offline again with one click.

Must include: a store settings page, a publish/unpublish switch, and a live web address for each shop. Each store must only ever show that shop's own data.

### **2.2 The Shop tab**

An online shop showing products from the shop's Sellify inventory.

**Example:** Mary has 4 refurbished iPhone 13s and 20 phone cases in Sellify. They appear on her Shop tab automatically, with photos, prices and stock. When she sells the last iPhone 13 in her physical shop through the POS, it shows as sold out online straight away. John adds a case to his basket and checks out.

Must include: product listing, product page, basket and checkout (Stripe in test mode is fine). An online order must reduce stock in Sellify and appear as a sale in Mary's backend.

### **2.3 The Repair tab**

Customers get a repair price and book their phone in.

**Example:** John's iPhone 12 screen is cracked. On the Repair tab he picks **Apple → iPhone 12 → Screen replacement**. He sees **€129**, taken from Mary's repair price list in Sellify. If Mary has the screen part in stock, it says "Same-day repair available". John picks Thursday at 2pm, enters his name, phone and email, and books. Mary gets an email ("New repair booking: iPhone 12 screen, Thursday 2pm, John"), and the booking appears as a repair ticket in Sellify. John gets a confirmation email.

Must include: brand → model → repair type selection, prices from Sellify's repair pricing, a stock check for the part, date/time booking, emails to both shop and customer, and a repair ticket created in Sellify.

### **2.4 The Sell tab**

Customers get a buyback quote for their old phone.

**Example:** John wants to sell his old Samsung S21. On the Sell tab he picks **Samsung → S21 → 128GB**, then answers a few condition questions (screen cracked? battery OK? turns on?). He sees an offer of **€140**, calculated from Mary's buyback prices in Sellify. He accepts and chooses "drop in to the shop". Mary is emailed and the buyback appears in her Sellify backend, ready for when John arrives.

Must include: model and condition selection, a quote calculated from Sellify's buyback prices, quote submission, and emails to both sides. The customer must not be able to change the price.

### **2.5 Editing the store from the backend**

The owner controls the content and look without touching code.

**Example:** Mary changes her opening hours, adds a banner saying "10% off screen repairs this week", swaps her main colour to green and hides the Sell tab because she has paused buybacks. She clicks **Preview** to check it, then **Publish**. Customers see nothing until she publishes.

Must include: edit logo, colours, banner, text, contact details and opening hours; show or hide each tab; preview before publishing.

### **2.6 Three templates**

Three different starting designs a shop can choose from.

**Example:** Mary chooses between **Clean** (white and minimal), **Bold** (dark, large photos) and **Local** (friendly, with a map and reviews up front). She switches from Clean to Bold and all her products, prices and settings carry over. Only the look changes.

Must include: 3 templates, switchable at any time without losing content.

### **2.7 AI store customizer**

The owner describes the look they want in plain words and the AI restyles their store.

**Example:** Mary types: *"Make it look premium, black and gold, like an Apple store."* The AI updates her colours, fonts and layout choices and shows her a preview. She can say *"Make the buttons bigger"*, then publish or undo.

Must include: a text box where the owner describes the style, a preview of the result, and undo. The AI must only change design settings, never prices, stock or other shops' data. Explain which AI service you would use and roughly what it costs per use.

### **2.8 Custom domain**

Owners can use their own web address instead of the Sellify one.

**Example:** Mary owns `fixitgalway.ie`. In settings she clicks **Connect domain**, types `fixitgalway.ie`, and Sellify shows her the exact DNS records to add at her domain provider. Once added, Sellify confirms the domain is connected and her store loads at `fixitgalway.ie` with a secure padlock (HTTPS).

Must include: add a domain, show DNS instructions, check and show connection status, HTTPS. Sellify is hosted on Vercel, so you can use Vercel's custom domain features or whichever platform you build on.

### **2.9 Create and publish a demo store with its own brand**

Use your finished feature, as a shop owner would, to create and publish a real demo store. Give it a **separate brand guideline** from Sellify's.

**Example:** You make up a shop, "FixIt Galway" or your own idea. You create its brand guideline: a simple logo, colours, fonts and tone. Then you log into Sellify as that shop, apply the brand through the store editor (template, colours, logo, banner), add demo products, repair prices and buyback prices, and click **Publish**. We should be able to visit the live store and book a repair, get a buyback quote and buy a product.

Must include:

* A short brand guideline for the demo store, different from Sellify's  
* The demo store set up and published entirely through the Sellify backend, with no hand-coded pages  
* All three tabs working with demo data

**The two brands side by side:** Sellify's backend screens follow the Sellify platform guideline (Part 1). The demo store's public pages follow the demo store's own guideline. This shows us both your platform design and how well the store editor handles a different brand.

## **Priorities**

| Order | What | Why it comes here |
| ----- | ----- | ----- |
| 1 | Part 1: brand guideline, shared components, all pages updated | Everything else is built with it |
| 2 | 2.1 Publish a store \+ 2.5 Editing \+ 2.9 Demo store live | The foundation of the feature |
| 3 | 2.3 Repair tab \+ 2.4 Sell tab | Core to repair shops, and unique to Sellify |
| 4 | 2.2 Shop tab with checkout | Online sales |
| 5 | 2.6 Templates \+ 2.8 Custom domain | Makes it feel like Shopify |
| 6 | 2.7 AI customizer | The standout feature, best built last on a solid base |