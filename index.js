// server.js
const express = require("express");
const cors = require("cors");
const app = express();
const PORT = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const dotenv = require("dotenv");
dotenv.config();

app.use(cors());
app.use(express.json());

const MONGO_URI = process.env.MONGO_URI;
const client = new MongoClient(MONGO_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

client
  .connect()
  .then(() => {
    console.log("MongoDB Connected");
  })
  .catch((err) => {
    console.log(err);
  });

async function run() {
  try {
    // await client.connect();

    const db = client.db("productdb");
    const collection = db.collection("products");

    // Get products with pagination, search, sorting
    app.get("/api/products", async (req, res) => {
      try {
          const {
              page = 1,
              limit = 12,
              search = "",
              category = "",
              minPrice = 0,
              maxPrice = Infinity,
              sortBy = "createdAt",
              sortOrder = "desc",
          } = req.query;
  console.log(req.query);
          const query = {};
          if (search) {
              query.$or = [
                  { productName: { $regex: search, $options: "i" } },
                  { description: { $regex: search, $options: "i" } },
                  { categories: { $regex: search, $options: "i" } },
              ];
          }
          if (category) {
              query.categories = category;
          }
          if (minPrice && maxPrice) {
              query.price = { $gte: parseFloat(minPrice), $lte: parseFloat(maxPrice) };
          }
  
          const sortOptions = {};
          if (sortBy === "price") {
              sortOptions.price = sortOrder === "asc" ? 1 : -1;
          } else if (sortBy === "createdAt") {
              sortOptions.createdAt = sortOrder === "asc" ? 1 : -1;
          }
  
          const products = await collection
              .find(query)
              .sort(sortOptions)
              .skip((page - 1) * limit)
              .limit(parseInt(limit))
              .toArray();
          const totalProducts = await collection.countDocuments(query);
  
          res.json({
              products,
              totalPages: Math.ceil(totalProducts / limit),
              currentPage: parseInt(page),
          });
      } catch (error) {
          res.status(500).json({ message: error.message });
      }
  });
  

    app.get("/api/categories", async (req, res) => {
      try {
        const products = await collection.find().toArray();

        const categories = products.reduce((acc, product) => {
          product.categories.forEach((cat) => {
            if (!acc.includes(cat)) {
              acc.push(cat);
            }
          });
          return acc;
        }, []);

        res.json(categories);
      } catch (error) {
        res.status(500).json({ message: error.message });
      }
    });


    app.get("/api/featured-products", async (req, res) => {
      try {
        const { minRating = 0, limit = 10 } = req.query;

        const query = {
          averageRating: { $gte: parseFloat(minRating) },
        };

        const products = await collection
          .find(query)
          .limit(parseInt(limit))
          .toArray();

        res.json(products);
      } catch (error) {
        res.status(500).json({ message: error.message });
      }
    });

    // Bulk insert endpoint
    app.post("/api/products/bulk-insert", async (req, res) => {
      try {
        const products = req.body;

        if (!Array.isArray(products)) {
          return res.status(400).json({
            success: false,
            message: "Invalid input. Expected an array of products.",
          });
        }

        // Insert products
        const result = await collection.insertMany(products);

        res.status(201).json({
          message: "Products inserted successfully.",
          insertedCount: result.insertedCount,
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          message: error.message,
          error,
        });
      }
    });

    // Create a new product
    app.post("/api/products", async (req, res) => {
      try {
        const {
          productName,
          productImage,
          description,
          price,
          category,
          averageRating,
        } = req.body;

        const newProduct = {
          productName,
          productImage,
          description,
          price,
          category,
          averageRating,
          createdAt: new Date(),
        };

        const result = await collection.insertOne(newProduct);
        res.status(201).json({
          success: true,
          message: "Product created successfully",
          data: result.ops[0],
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          message: error.message,
          error: error,
        });
      }
    });

    // Get a single product by ID
    app.get("/api/products/:id", async (req, res) => {
      try {
        const product = await collection.findOne({
          _id: new ObjectId(req.params.id),
        });

        if (!product)
          return res.status(404).json({ message: "Product not found" });

        res.json(product);
      } catch (error) {
        res.status(500).json({
          success: false,
          message: "Internal server error",
          error: error.message,
        });
      }
    });

    app.get("/", (req, res) => {
      res.send("Hello World!");
    });

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
  }
}

run();
