const express = require("express");
const app = express();
const port = 3000;

app.use(express.urlencoded({ extended: true }));

// contoh XSS endpoint
app.get("/xss", (req, res) => {
  const q = req.query.q || "";
  res.send(`
    <html>
      <head><title>XSS Test</title></head>
      <body>
        <h1>Hasil Pencarian:</h1>
        <p>${q}</p>
        <form method="GET" action="/xss">
          <input name="q" placeholder="cari apa bro?">
          <button type="submit">Cari</button>
        </form>
      </body>
    </html>
  `);
});

app.listen(port, () => console.log(`XSS test listening on http://localhost:${port}`));
