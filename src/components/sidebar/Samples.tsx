import { useState } from "react";
import { BookOpen, ChevronRight, ChevronDown, FileCode } from "lucide-react";
import { useTabStore } from "@/stores/tabStore";

interface SampleEntry {
  name: string;
  content: string;
}

interface SampleCategory {
  name: string;
  samples: SampleEntry[];
}

const SAMPLE_DATA: SampleCategory[] = [
  {
    name: "MongoDB Basic CRUD Operations",
    samples: [
      {
        name: "Insert Documents",
        content: `// Insert a single document
db.inventory.insertOne({
  item: "canvas",
  qty: 100,
  tags: ["cotton"],
  size: { h: 28, w: 35.5, uom: "cm" }
})

// Insert multiple documents
db.inventory.insertMany([
  { item: "journal", qty: 25, tags: ["blank", "red"], size: { h: 14, w: 21, uom: "cm" } },
  { item: "mat", qty: 85, tags: ["gray"], size: { h: 27.9, w: 35.5, uom: "cm" } },
  { item: "mousepad", qty: 25, tags: ["gel", "blue"], size: { h: 19, w: 22.85, uom: "cm" } }
])`,
      },
      {
        name: "Query Documents",
        content: `// Find all documents
db.inventory.find({})

// Equality condition
db.inventory.find({ status: "D" })

// Using query operators
db.inventory.find({ status: { $in: ["A", "D"] } })

// AND conditions
db.inventory.find({ status: "A", qty: { $lt: 30 } })

// OR conditions
db.inventory.find({ $or: [{ status: "A" }, { qty: { $lt: 30 } }] })`,
      },
      {
        name: "Update Documents",
        content: `// Update a single document
db.inventory.updateOne(
  { item: "paper" },
  {
    $set: { "size.uom": "cm", status: "P" },
    $currentDate: { lastModified: true }
  }
)

// Update multiple documents
db.inventory.updateMany(
  { qty: { $lt: 50 } },
  {
    $set: { "size.uom": "in", status: "P" },
    $currentDate: { lastModified: true }
  }
)

// Replace a document
db.inventory.replaceOne(
  { item: "paper" },
  { item: "paper", instock: [{ warehouse: "A", qty: 60 }, { warehouse: "B", qty: 40 }] }
)`,
      },
      {
        name: "Delete Documents",
        content: `// Delete all documents matching a condition
db.inventory.deleteMany({ status: "A" })

// Delete a single document
db.inventory.deleteOne({ status: "D" })

// Delete all documents
db.inventory.deleteMany({})`,
      },
      {
        name: "Count & Distinct",
        content: `// Count documents
db.inventory.countDocuments({ status: "A" })

// Estimated count (faster, no filter)
db.inventory.estimatedDocumentCount()

// Distinct values
db.inventory.distinct("status")

// Distinct with filter
db.inventory.distinct("item", { qty: { $gt: 50 } })`,
      },
    ],
  },
  {
    name: "Query Operators",
    samples: [
      {
        name: "Comparison Operators",
        content: `// $gt, $gte, $lt, $lte
db.inventory.find({ qty: { $gt: 20 } })
db.inventory.find({ qty: { $gte: 20, $lte: 50 } })

// $eq, $ne
db.inventory.find({ status: { $eq: "A" } })
db.inventory.find({ status: { $ne: "D" } })

// $in, $nin
db.inventory.find({ status: { $in: ["A", "B"] } })
db.inventory.find({ qty: { $nin: [5, 15] } })`,
      },
      {
        name: "Logical Operators",
        content: `// $and
db.inventory.find({
  $and: [{ price: { $ne: 1.99 } }, { price: { $exists: true } }]
})

// $or
db.inventory.find({
  $or: [{ qty: { $lt: 20 } }, { price: 10 }]
})

// $not
db.inventory.find({ price: { $not: { $gt: 1.99 } } })

// $nor
db.inventory.find({
  $nor: [{ price: 1.99 }, { sale: true }]
})`,
      },
      {
        name: "Element & Evaluation",
        content: `// $exists - field exists
db.inventory.find({ qty: { $exists: true, $nin: [5, 15] } })

// $type - field type
db.inventory.find({ qty: { $type: "number" } })

// $regex - pattern matching
db.products.find({ sku: { $regex: /^ABC/i } })

// $text - text search (requires text index)
db.articles.find({ $text: { $search: "coffee" } })`,
      },
      {
        name: "Array Operators",
        content: `// $all - matches arrays containing all elements
db.inventory.find({ tags: { $all: ["ssl", "security"] } })

// $elemMatch - element matches all conditions
db.results.find({ results: { $elemMatch: { $gte: 80, $lt: 85 } } })

// $size - array size
db.inventory.find({ tags: { $size: 3 } })

// Array query by index
db.inventory.find({ "tags.0": "red" })`,
      },
    ],
  },
  {
    name: "Aggregation Pipeline",
    samples: [
      {
        name: "$match + $group",
        content: `// Group by status and calculate totals
db.orders.aggregate([
  { $match: { status: "A" } },
  { $group: {
    _id: "$cust_id",
    total: { $sum: "$amount" },
    count: { $sum: 1 },
    avgAmount: { $avg: "$amount" }
  }},
  { $sort: { total: -1 } }
])`,
      },
      {
        name: "$lookup (Join)",
        content: `// Left outer join with another collection
db.orders.aggregate([
  { $lookup: {
    from: "inventory",
    localField: "item",
    foreignField: "sku",
    as: "inventory_docs"
  }},
  { $project: {
    item: 1,
    qty: 1,
    inventory: { $arrayElemAt: ["$inventory_docs", 0] }
  }}
])`,
      },
      {
        name: "$unwind + $group",
        content: `// Deconstruct array and re-group
db.inventory.aggregate([
  { $unwind: "$tags" },
  { $group: {
    _id: "$tags",
    count: { $sum: 1 },
    avgQty: { $avg: "$qty" }
  }},
  { $sort: { count: -1 } }
])`,
      },
      {
        name: "$facet (Multi-pipeline)",
        content: `// Run multiple pipelines in parallel
db.orders.aggregate([
  { $facet: {
    byStatus: [
      { $group: { _id: "$status", count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ],
    byDate: [
      { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$date" } }, total: { $sum: "$amount" } } },
      { $sort: { _id: 1 } }
    ],
    totalAmount: [
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]
  }}
])`,
      },
      {
        name: "$bucket",
        content: `// Bucket by price ranges
db.products.aggregate([
  { $bucket: {
    groupBy: "$price",
    boundaries: [0, 10, 50, 100, 500],
    default: "Other",
    output: {
      count: { $sum: 1 },
      avgPrice: { $avg: "$price" },
      items: { $push: "$name" }
    }
  }}
])`,
      },
    ],
  },
  {
    name: "Index Operations",
    samples: [
      {
        name: "Index Management",
        content: `// Create a single field index
db.collection.createIndex({ field: 1 })

// Create a compound index
db.collection.createIndex({ field1: 1, field2: -1 })

// Create a unique index
db.collection.createIndex({ email: 1 }, { unique: true })

// Create a text index
db.articles.createIndex({ content: "text", title: "text" })

// Create a TTL index (auto-expire after 3600 seconds)
db.sessions.createIndex({ createdAt: 1 }, { expireAfterSeconds: 3600 })

// List all indexes
db.collection.getIndexes()

// Drop an index
db.collection.dropIndex("field_1")`,
      },
    ],
  },
];

export function Samples() {
  const addTab = useTabStore((s) => s.addTab);

  const handleOpen = (sample: SampleEntry) => {
    addTab({
      id: crypto.randomUUID(),
      title: sample.name,
      type: "query",
      content: sample.content,
      dirty: false,
    });
  };

  return (
    <div className="pb-2">
      {SAMPLE_DATA.map((category) => (
        <CategoryNode key={category.name} category={category} onOpenSample={handleOpen} />
      ))}
    </div>
  );
}

function CategoryNode({
  category,
  onOpenSample,
}: {
  category: SampleCategory;
  onOpenSample: (sample: SampleEntry) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div>
      <button
        type="button"
        className="flex w-full items-center gap-2 rounded px-3 py-1 text-xs text-sidebar-foreground hover:bg-sidebar-border/50"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? (
          <ChevronDown className="h-3 w-3 shrink-0" />
        ) : (
          <ChevronRight className="h-3 w-3 shrink-0" />
        )}
        <BookOpen className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{category.name}</span>
        <span className="ml-auto text-[10px] text-muted-foreground">{category.samples.length}</span>
      </button>
      {expanded &&
        category.samples.map((sample) => (
          <button
            key={sample.name}
            type="button"
            className="flex w-full items-center gap-2 rounded pl-9 pr-3 py-0.5 text-xs text-sidebar-foreground/70 hover:bg-sidebar-border/50 hover:text-sidebar-foreground"
            onClick={() => onOpenSample(sample)}
          >
            <FileCode className="h-3 w-3 shrink-0" />
            <span className="truncate">{sample.name}</span>
          </button>
        ))}
    </div>
  );
}
