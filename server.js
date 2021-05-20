const express = require("express");
const weather = require("./routes");
const app = express();

app.use("/", weather);

const port = 3000;
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.listen(port, () => console.log(`LETS GOOOOO: listening on port: ${port}`));
