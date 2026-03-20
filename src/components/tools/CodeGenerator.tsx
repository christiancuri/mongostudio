import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Copy, Code2 } from "lucide-react";
import { toast } from "sonner";

interface CodeGeneratorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  query: string;
  collection: string;
  database: string;
}

type Language =
  | "nodejs"
  | "python"
  | "java"
  | "csharp"
  | "go"
  | "ruby"
  | "php";

const LANGUAGES: { value: Language; label: string }[] = [
  { value: "nodejs", label: "Node.js" },
  { value: "python", label: "Python" },
  { value: "java", label: "Java" },
  { value: "csharp", label: "C#" },
  { value: "go", label: "Go" },
  { value: "ruby", label: "Ruby" },
  { value: "php", label: "PHP" },
];

export function CodeGenerator({
  open,
  onOpenChange,
  query,
  collection,
  database,
}: CodeGeneratorProps) {
  const [language, setLanguage] = useState<Language>("nodejs");

  const generated = useMemo(
    () => generateCode(query, collection, database, language),
    [query, collection, database, language]
  );

  const handleCopy = () => {
    navigator.clipboard.writeText(generated);
    toast.success("Code copied to clipboard");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[650px] max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Code2 className="h-4 w-4" />
            Code Generator
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-3">
          <Select
            value={language}
            onValueChange={(v) => setLanguage(v as Language)}
          >
            <SelectTrigger className="h-8 w-[150px] text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGES.map((lang) => (
                <SelectItem key={lang.value} value={lang.value}>
                  {lang.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5"
            onClick={handleCopy}
          >
            <Copy className="h-3 w-3" />
            Copy
          </Button>
        </div>

        <div className="space-y-2">
          <div className="rounded border border-border bg-muted/30 p-2">
            <p className="text-[10px] text-muted-foreground mb-1">
              Source query:
            </p>
            <pre className="font-mono text-xs text-foreground whitespace-pre-wrap">
              {query || "No query"}
            </pre>
          </div>
        </div>

        <ScrollArea className="flex-1 rounded border border-border bg-[#1e1e1e] p-3">
          <pre className="font-mono text-xs text-[#d4d4d4] whitespace-pre-wrap">
            {generated}
          </pre>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function generateCode(
  query: string,
  collection: string,
  database: string,
  language: Language
): string {
  const parsed = parseShellQuery(query);
  if (!parsed) {
    return `// Could not parse query: ${query}`;
  }

  switch (language) {
    case "nodejs":
      return generateNodeJs(parsed, collection, database);
    case "python":
      return generatePython(parsed, collection, database);
    case "java":
      return generateJava(parsed, collection, database);
    case "csharp":
      return generateCSharp(parsed, collection, database);
    case "go":
      return generateGo(parsed, collection, database);
    case "ruby":
      return generateRuby(parsed, collection, database);
    case "php":
      return generatePhp(parsed, collection, database);
    default:
      return "// Unsupported language";
  }
}

interface ParsedShellQuery {
  method: string;
  args: string[];
}

function parseShellQuery(query: string): ParsedShellQuery | null {
  const trimmed = query.trim();
  // Match: db.collection.method(args)
  const match = trimmed.match(/db\.\w+\.(\w+)\(([^]*)\)\s*$/);
  if (!match) return null;

  const method = match[1];
  const argsStr = match[2].trim();

  // Simple args split (not perfect but works for basic cases)
  const args = argsStr ? [argsStr] : [];

  return { method, args };
}

function generateNodeJs(
  parsed: ParsedShellQuery,
  collection: string,
  database: string
): string {
  const args = parsed.args[0] ?? "{}";

  return `const { MongoClient } = require("mongodb");

const uri = "mongodb://localhost:27017";
const client = new MongoClient(uri);

async function main() {
  try {
    await client.connect();
    const db = client.db("${database}");
    const collection = db.collection("${collection}");

    const result = await collection.${parsed.method}(${args});
    ${parsed.method === "find" ? 'const docs = await result.toArray();\n    console.log(docs);' : "console.log(result);"}
  } finally {
    await client.close();
  }
}

main().catch(console.error);`;
}

function generatePython(
  parsed: ParsedShellQuery,
  collection: string,
  database: string
): string {
  const args = parsed.args[0] ?? "{}";

  return `from pymongo import MongoClient

client = MongoClient("mongodb://localhost:27017")
db = client["${database}"]
collection = db["${collection}"]

result = collection.${toSnakeCase(parsed.method)}(${args})
${parsed.method === "find" ? "for doc in result:\n    print(doc)" : "print(result)"}

client.close()`;
}

function generateJava(
  parsed: ParsedShellQuery,
  collection: string,
  database: string
): string {
  const args = parsed.args[0] ?? "{}";
  const methodMap: Record<string, string> = {
    find: "find",
    findOne: "find().first",
    insertOne: "insertOne",
    insertMany: "insertMany",
    updateOne: "updateOne",
    updateMany: "updateMany",
    deleteOne: "deleteOne",
    deleteMany: "deleteMany",
    countDocuments: "countDocuments",
    aggregate: "aggregate",
  };
  const javaMethod = methodMap[parsed.method] ?? parsed.method;

  return `import com.mongodb.client.*;
import org.bson.Document;

public class MongoQuery {
    public static void main(String[] args) {
        try (MongoClient client = MongoClients.create("mongodb://localhost:27017")) {
            MongoDatabase db = client.getDatabase("${database}");
            MongoCollection<Document> collection = db.getCollection("${collection}");

            Document filter = Document.parse("${args.replace(/"/g, '\\"')}");
            ${
              parsed.method === "find"
                ? `FindIterable<Document> result = collection.${javaMethod}(filter);
            for (Document doc : result) {
                System.out.println(doc.toJson());
            }`
                : `var result = collection.${javaMethod}(filter);
            System.out.println(result);`
            }
        }
    }
}`;
}

function generateCSharp(
  parsed: ParsedShellQuery,
  collection: string,
  database: string
): string {
  const args = parsed.args[0] ?? "{}";
  const csMethod =
    parsed.method.charAt(0).toUpperCase() + parsed.method.slice(1);

  return `using MongoDB.Driver;
using MongoDB.Bson;

var client = new MongoClient("mongodb://localhost:27017");
var db = client.GetDatabase("${database}");
var collection = db.GetCollection<BsonDocument>("${collection}");

var filter = BsonDocument.Parse(@"${args.replace(/"/g, '""')}");
${
  parsed.method === "find"
    ? `var result = await collection.Find(filter).ToListAsync();
foreach (var doc in result)
{
    Console.WriteLine(doc.ToJson());
}`
    : `var result = await collection.${csMethod}Async(filter);
Console.WriteLine(result);`
}`;
}

function generateGo(
  parsed: ParsedShellQuery,
  collection: string,
  database: string
): string {
  const args = parsed.args[0] ?? "{}";

  return `package main

import (
	"context"
	"fmt"
	"log"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

func main() {
	ctx := context.Background()
	client, err := mongo.Connect(ctx, options.Client().ApplyURI("mongodb://localhost:27017"))
	if err != nil {
		log.Fatal(err)
	}
	defer client.Disconnect(ctx)

	collection := client.Database("${database}").Collection("${collection}")

	filter := bson.D{} // Parsed from: ${args}
${
  parsed.method === "find"
    ? `	cursor, err := collection.Find(ctx, filter)
	if err != nil {
		log.Fatal(err)
	}
	var results []bson.M
	if err = cursor.All(ctx, &results); err != nil {
		log.Fatal(err)
	}
	for _, doc := range results {
		fmt.Println(doc)
	}`
    : `	result, err := collection.${capitalizeFirst(parsed.method)}(ctx, filter)
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println(result)`
}
}`;
}

function generateRuby(
  parsed: ParsedShellQuery,
  collection: string,
  database: string
): string {
  const args = parsed.args[0] ?? "{}";
  const rubyMethod = toSnakeCase(parsed.method);

  return `require 'mongo'

client = Mongo::Client.new(['localhost:27017'], database: '${database}')
collection = client[:${collection}]

result = collection.${rubyMethod}(${args})
${parsed.method === "find" ? "result.each do |doc|\n  puts doc\nend" : "puts result"}

client.close`;
}

function generatePhp(
  parsed: ParsedShellQuery,
  collection: string,
  database: string
): string {
  const args = parsed.args[0] ?? "{}";
  const phpMethod = parsed.method;

  return `<?php
require 'vendor/autoload.php';

$client = new MongoDB\\Client("mongodb://localhost:27017");
$collection = $client->${database}->${collection};

$filter = MongoDB\\BSON\\Document::fromJSON('${args}');
$result = $collection->${phpMethod}($filter);

${
  parsed.method === "find"
    ? 'foreach ($result as $doc) {\n    echo MongoDB\\BSON\\Document::fromPHP($doc)->toCanonicalExtendedJSON(), "\\n";\n}'
    : "var_dump($result);"
}`;
}

function toSnakeCase(str: string): string {
  return str.replace(/([A-Z])/g, "_$1").toLowerCase();
}

function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
