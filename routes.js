const express = require("express");
const router = express.Router();
const pgp = require("pg-promise")();

router.use(express.json());

const db = pgp({
  database: "weather",
  user: "postgres",
});

router.get("/states", async (req, res) => {
  res.json(await db.many("SELECT * from states"));
});

router.get("/states/:abbrev", async (req, res) => {
  const state = await db.oneOrNone(
    `SELECT * from states WHERE abbrev = $(abbrev)`,
    {
      abbrev: req.params.abbrev,
    }
  );

  if (!state) {
    return res.status(404).send("The state could not be found");
  }

  res.json(state);
});

router.get("/cities", async (req, res) => {
  res.json(
    await db.many(
      `SELECT s.name as state, c.name as city, c.id 
      FROM cities c 
      JOIN states s ON s.abbrev = c.state_abbrev`
    )
  );
});

router.get("/cities/:id", async (req, res) => {
  res.json(
    await db.oneOrNone(
      `SELECT c.name, avg(temperature)  
        FROM temperatures t 
        JOIN cities c ON c.id = t.city_id
        WHERE c.id = $(city_id)
        GROUP BY c.id, c.name`,
      {
        city_id: +req.params.id,
      }
    )
  );
});

router.get("/temperature/:climate", async (req, res) => {
  res.json(
    await db.oneOrNone(
      `SELECT avg(temperature)
                FROM temperatures t
                JOIN cities c ON c.id = t.city_id
                WHERE c.climate = $(climate) `,
      {
        climate: req.params.climate,
      }
    )
  );
});

router.post("/states", async (req, res) => {
  try {
    if (!req.body.abbrev) {
      return res.status(400).send("Invalid abbreviation");
    }
    if (!req.body.name) {
      return res.status(400).send("Invalid name");
    }
    await db.none(
      `INSERT INTO states (abbrev, name) values ($(abbrev), $(name))`,
      {
        abbrev: req.body.abbrev,
        name: req.body.name,
      }
    );
    const state = await db.oneOrNone(
      `SELECT * from states WHERE abbrev = $(abbrev)`,
      {
        abbrev: req.body.abbrev,
      }
    );
    res.status(201).json(state);
  } catch (error) {
    if (error.constraint === "states_pkey") {
      return res.status(400).send("This state already exists");
    }
  }
});

router.post("/cities", async (req, res) => {
  try {
    if (!req.body.state_abbrev) {
      return res.status(400).send("Invalid abbreviation");
    }
    if (!req.body.name) {
      return res.status(400).send("Invalid name");
    }
    if (!req.body.climate) {
      return res.status(400).send("Invalid climate");
    }
    const result = await db.oneOrNone(
      `INSERT INTO cities (state_abbrev, name, climate) values ($(abbrev), $(name), $(climate)) RETURNING id`,
      {
        abbrev: req.body.state_abbrev,
        name: req.body.name,
        climate: req.body.climate,
      }
    );

    const city = await db.oneOrNone(`SELECT * from cities WHERE id = $(id)`, {
      id: result.id,
    });
    res.status(201).json(city);
  } catch (error) {
    console.log(error);
    if (error.constraint === "cities_state_name") {
      return res.status(400).send("This city already exists");
    }
  }
});

router.post("/temperatures", async (req, res) => {
  try {
    if (!parseInt(req.body.city)) {
      return res.status(400).send("Invalid city id");
    }

    if (!parseInt(req.body.temperature)) {
      return res.status(400).send("Invalid temperature");
    }

    if (!req.body.date) {
      return res.status(400).send("Invalid Date");
    }

    const result = await db.oneOrNone(
      `INSERT INTO temperatures (city_id, temperature, date) values ($(city_id), $(temperature), $(date))RETURNING id`,
      {
        city_id: parseInt(req.body.city),
        temperature: parseInt(req.body.temperature),
        date: req.body.date,
      }
    );

    const newTemp = await db.oneOrNone(
      `SELECT * from temperatures WHERE id = $(id)`,
      {
        id: result.id,
      }
    );
    res.status(201).json(newTemp);
  } catch (error) {
    console.log(error);
    if (error.constraint === "city_date") {
      return res
        .status(400)
        .send("That city already has an entry for that date");
    }
  }
});

router.delete("/cities/:id", async (req, res) => {
  await db.none(`DELETE FROM cities WHERE id = $(id)`, { id: +req.params.id });
  res.status(204).send();
});
router.delete("/states/:abbrev", async (req, res) => {
  await db.none(`DELETE FROM states WHERE abbrev = $(abbrev)`, {
    abbrev: req.params.abbrev,
  });
  res.status(204).send();
});
router.delete("/temperatures/:id", async (req, res) => {
  await db.none(`DELETE FROM temperatures WHERE id = $(id)`, {
    id: +req.params.id,
  });
  res.status(204).send();
});

router.put("/states/:abbrev", async (req, res) => {
  const state = await db.oneOrNone(
    `SELECT * from states WHERE abbrev = $(abbrev)`,
    {
      abbrev: req.params.abbrev,
    }
  );

  if (!state) {
    return res.status(404).send("The state could not be found");
  }

  const result = await db.oneOrNone(
    `UPDATE states set $(column) = $(change) WHERE abbrev = $(abbrev) RETURNING abbrev`,
    {
      abbrev: req.params.abbrev,
      column: req.body.column,
      change: req.body.change,
    }
  );
  res.json(
    await db.oneOrNone(`SELECT * from states WHERE abbrev = $(abbrev)`, {
      abbrev: result.abbrev,
    })
  );
});

router.put("/cities/:id", async (req, res) => {
  const city = await db.oneOrNone(`SELECT * from cities WHERE id = $(id)`, {
    id: +req.params.id,
  });

  if (!city) {
    return res.status(404).send("The city could not be found");
  }

  const result = await db.oneOrNone(
    `UPDATE cities set $(column) = $(change) WHERE id = $(id) RETURNING id`,
    {
      id: +req.params.id,
      column: req.body.column,
      change: req.body.change,
    }
  );
  res.json(
    await db.oneOrNone(`SELECT * from cities WHERE id = $(id)`, {
      id: result.id,
    })
  );
});

router.put("/temperatures/:id", async (req, res) => {
  const temperature = await db.oneOrNone(
    `SELECT * from states WHERE id = $(id)`,
    {
      id: +req.params.id,
    }
  );

  if (!temperature) {
    return res.status(404).send("The temperature could not be found");
  }

  const result = await db.oneOrNone(
    `UPDATE temperatures set $(column) = $(change) WHERE id = $(id) RETURNING id`,
    {
      id: +req.params.id,
      column: req.body.column,
      change: req.body.change,
    }
  );
  res.json(
    await db.oneOrNone(`SELECT * from states WHERE id = $(id)`, {
      id: result.id,
    })
  );
});
module.exports = router;
