import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Trash2, Sparkles, Eye } from "lucide-react";
import { toast } from "sonner";
import { faker } from "@faker-js/faker";
import { useTabStore } from "@/stores/tabStore";

interface DataGeneratorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connectionId?: string;
  database?: string;
  collection?: string;
}

interface FieldDef {
  id: string;
  name: string;
  fakerMethod: string;
  nullable: number;
}

const FAKER_METHODS = [
  { category: "Person", methods: [
    { value: "person.firstName", label: "First Name" },
    { value: "person.lastName", label: "Last Name" },
    { value: "person.fullName", label: "Full Name" },
    { value: "person.gender", label: "Gender" },
    { value: "person.jobTitle", label: "Job Title" },
  ]},
  { category: "Internet", methods: [
    { value: "internet.email", label: "Email" },
    { value: "internet.username", label: "Username" },
    { value: "internet.url", label: "URL" },
    { value: "internet.ip", label: "IP Address" },
    { value: "internet.password", label: "Password" },
  ]},
  { category: "Location", methods: [
    { value: "location.city", label: "City" },
    { value: "location.country", label: "Country" },
    { value: "location.state", label: "State" },
    { value: "location.streetAddress", label: "Street Address" },
    { value: "location.zipCode", label: "Zip Code" },
    { value: "location.latitude", label: "Latitude" },
    { value: "location.longitude", label: "Longitude" },
  ]},
  { category: "Commerce", methods: [
    { value: "commerce.productName", label: "Product Name" },
    { value: "commerce.price", label: "Price" },
    { value: "commerce.department", label: "Department" },
  ]},
  { category: "Date", methods: [
    { value: "date.past", label: "Past Date" },
    { value: "date.future", label: "Future Date" },
    { value: "date.recent", label: "Recent Date" },
    { value: "date.birthdate", label: "Birthdate" },
  ]},
  { category: "Lorem", methods: [
    { value: "lorem.sentence", label: "Sentence" },
    { value: "lorem.paragraph", label: "Paragraph" },
    { value: "lorem.word", label: "Word" },
    { value: "lorem.words", label: "Words" },
  ]},
  { category: "Number", methods: [
    { value: "number.int", label: "Integer" },
    { value: "number.float", label: "Float" },
  ]},
  { category: "Datatype", methods: [
    { value: "datatype.boolean", label: "Boolean" },
    { value: "string.uuid", label: "UUID" },
  ]},
  { category: "Company", methods: [
    { value: "company.name", label: "Company Name" },
    { value: "company.catchPhrase", label: "Catch Phrase" },
    { value: "company.buzzPhrase", label: "Buzz Phrase" },
  ]},
  { category: "Phone", methods: [
    { value: "phone.number", label: "Phone Number" },
  ]},
  { category: "Image", methods: [
    { value: "image.url", label: "Image URL" },
    { value: "image.avatar", label: "Avatar URL" },
  ]},
];

function generateFakerValue(method: string): unknown {
  try {
    const parts = method.split(".");
    let current: unknown = faker;
    for (const part of parts) {
      current = (current as Record<string, unknown>)[part];
    }
    if (typeof current === "function") {
      return (current as () => unknown)();
    }
    return null;
  } catch {
    return null;
  }
}

export function DataGenerator({ open, onOpenChange, connectionId, database, collection }: DataGeneratorProps) {
  const addTab = useTabStore((s) => s.addTab);
  const [targetCollection, setTargetCollection] = useState(collection ?? "");
  const [docCount, setDocCount] = useState(10);
  const [fields, setFields] = useState<FieldDef[]>([
    { id: crypto.randomUUID(), name: "name", fakerMethod: "person.fullName", nullable: 0 },
    { id: crypto.randomUUID(), name: "email", fakerMethod: "internet.email", nullable: 0 },
    { id: crypto.randomUUID(), name: "age", fakerMethod: "number.int", nullable: 0 },
  ]);
  const [preview, setPreview] = useState<string>("");

  const addField = () => {
    setFields([
      ...fields,
      { id: crypto.randomUUID(), name: "", fakerMethod: "person.firstName", nullable: 0 },
    ]);
  };

  const removeField = (id: string) => {
    setFields(fields.filter((f) => f.id !== id));
  };

  const updateField = (id: string, updates: Partial<FieldDef>) => {
    setFields(fields.map((f) => (f.id === id ? { ...f, ...updates } : f)));
  };

  const generatePreview = useCallback(() => {
    const docs = Array.from({ length: Math.min(3, docCount) }, () => {
      const doc: Record<string, unknown> = {};
      for (const field of fields) {
        if (!field.name) continue;
        if (field.nullable > 0 && Math.random() * 100 < field.nullable) {
          doc[field.name] = null;
        } else {
          doc[field.name] = generateFakerValue(field.fakerMethod);
        }
      }
      return doc;
    });
    setPreview(JSON.stringify(docs, null, 2));
  }, [fields, docCount]);

  const handleGenerate = () => {
    if (!targetCollection) {
      toast.error("Please specify a target collection");
      return;
    }
    if (fields.filter((f) => f.name).length === 0) {
      toast.error("Please add at least one field");
      return;
    }

    const docsArray = Array.from({ length: docCount }, () => {
      const entries = fields
        .filter((f) => f.name)
        .map((f) => {
          if (f.nullable > 0 && Math.random() * 100 < f.nullable) {
            return `    ${f.name}: null`;
          }
          const val = generateFakerValue(f.fakerMethod);
          const formatted =
            typeof val === "string"
              ? `"${val.replace(/"/g, '\\"')}"`
              : val instanceof Date
                ? `ISODate("${val.toISOString()}")`
                : String(val);
          return `    ${f.name}: ${formatted}`;
        });
      return `  {\n${entries.join(",\n")}\n  }`;
    });

    const script = `db.${targetCollection}.insertMany([\n${docsArray.join(",\n")}\n])`;

    addTab({
      id: crypto.randomUUID(),
      title: `Generate: ${targetCollection}`,
      type: "query",
      connectionId,
      database,
      collection: targetCollection,
      content: script,
      dirty: true,
    });

    toast.success(`Generated ${docCount} documents`);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[600px] max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Sparkles className="h-4 w-4" />
            Data Generator
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Target Collection</Label>
              <Input
                className="h-8 text-sm"
                value={targetCollection}
                onChange={(e) => setTargetCollection(e.target.value)}
                placeholder="collection_name"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Document Count</Label>
              <Input
                className="h-8 text-sm"
                type="number"
                value={docCount}
                onChange={(e) => setDocCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
                min={1}
                max={10000}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Fields</Label>
              <Button variant="ghost" size="sm" className="h-5 gap-1 px-1.5 text-[10px]" onClick={addField}>
                <Plus className="h-3 w-3" />
                Add Field
              </Button>
            </div>
            <ScrollArea className="max-h-[200px]">
              <div className="space-y-1.5">
                {fields.map((field) => (
                  <div key={field.id} className="flex gap-2 items-center">
                    <Input
                      className="h-7 text-xs w-[120px]"
                      value={field.name}
                      onChange={(e) => updateField(field.id, { name: e.target.value })}
                      placeholder="field_name"
                    />
                    <Select
                      value={field.fakerMethod}
                      onValueChange={(v) => updateField(field.id, { fakerMethod: v })}
                    >
                      <SelectTrigger className="h-7 text-xs flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FAKER_METHODS.map((cat) => (
                          <div key={cat.category}>
                            <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground">
                              {cat.category}
                            </div>
                            {cat.methods.map((m) => (
                              <SelectItem key={m.value} value={m.value} className="text-xs">
                                {m.label}
                              </SelectItem>
                            ))}
                          </div>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      className="h-7 text-xs w-[50px]"
                      type="number"
                      value={field.nullable}
                      onChange={(e) =>
                        updateField(field.id, { nullable: Math.max(0, Math.min(100, parseInt(e.target.value, 10) || 0)) })
                      }
                      title="Null %"
                      min={0}
                      max={100}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 shrink-0"
                      onClick={() => removeField(field.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>

          {preview && (
            <div className="space-y-1.5">
              <Label className="text-xs">Preview</Label>
              <ScrollArea className="h-32 rounded border border-border bg-black/50 p-2">
                <pre className="font-mono text-[10px] text-muted-foreground">{preview}</pre>
              </ScrollArea>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={generatePreview} className="gap-1.5">
            <Eye className="h-3 w-3" />
            Preview
          </Button>
          <Button size="sm" onClick={handleGenerate} className="gap-1.5">
            <Sparkles className="h-3 w-3" />
            Generate Script
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
