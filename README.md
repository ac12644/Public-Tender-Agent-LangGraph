# **Tender Agent**

🚧 **Project under active development** — expect frequent updates and improvements.

**Tender Agent** is a web app that helps users search, explore, and understand **public tenders in Italy and the EU**.

## It combines a **chat interface** with AI-powered summaries and direct links to the official **TED (Tenders Electronic Daily)** platform.

## 🎬 Demo

<p align="center">
  <img src="./public/video.gif" alt="Tender Agent Demo" width="800" height="500" />
</p>

---

## **✨ Features**

- 🔎 **Search tenders** using natural language (e.g. _“trova bandi informatica pubblicati oggi in Italia”_).
- 📊 **View details** such as buyer, publication date, deadlines, CPV codes, and values.
- 📝 **AI-generated summaries** in Italian for each tender.
- 📂 **Download official documents** (PDF links directly from TED).
- 💬 **Chat interface** for asking questions and getting results in an easy way.

---

## **🖥 How It Works**

- The **frontend** (Next.js) provides a clean chat interface with tender cards.
- The **backend** (Firebase Functions) connects to the **TED API**, processes data, and generates summaries.
- The **AI agent** is built with **LangGraph**, which manages conversation flow, tools, and memory.
- **Firestore** is used to save summaries and match scores for later use.

---

## **🚀 Usage**

1. Open the app.
2. Type a query (e.g. _“mostra bandi con scadenza entro 7 giorni in Lombardia”_).
3. Explore the results: check the buyer, deadlines, values, and description.
4. Open the official TED link or download the tender in PDF.

---

## **📌 Goal**

Tender Agent makes **complex tender documents easy to access and understand**, helping companies, freelancers, and consultants quickly find the opportunities that matter to them.
