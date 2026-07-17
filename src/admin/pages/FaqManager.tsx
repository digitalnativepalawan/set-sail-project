import { Plus, Trash2 } from "lucide-react";
import { useCms } from "@/context/CmsContext";
import { useToast } from "@/context/ToastContext";
import { Button, Card, Field, Input, Textarea } from "@/components/ui";
import { PageHeader, EmptyState } from "../shared/PageHeader";
import { SortableList } from "../shared/SortableList";
import type { Faq } from "@/types/cms";

export default function FaqManager() {
  const { data, update } = useCms();
  const { notify } = useToast();
  const items = [...data.faqs].sort((a, b) => a.order - b.order);

  const setAll = (next: Faq[]) => update((d) => ({ ...d, faqs: next }));

  const addItem = () => {
    setAll([...items, { id: `faq_${Date.now()}`, question: "New question?", answer: "Answer goes here.", order: items.length }]);
    notify("FAQ added");
  };

  return (
    <div>
      <PageHeader
        title="FAQ Manager"
        description="Add, edit, delete and reorder frequently asked questions."
        actions={<Button onClick={addItem}><Plus className="h-4 w-4" /> Add FAQ</Button>}
      />

      {items.length === 0 ? (
        <EmptyState title="No FAQs yet" description="Add your first question." />
      ) : (
        <SortableList
          items={items}
          onChange={(next) => setAll(next.map((it, idx) => ({ ...it, order: idx })))}
          renderItem={(faq, handle) => (
            <Card className="p-4">
              <div className="flex items-start gap-3">
                {handle}
                <div className="flex-1 space-y-2">
                  <Field label="Question">
                    <Input value={faq.question} onChange={(e) => setAll(items.map((i) => (i.id === faq.id ? { ...i, question: e.target.value } : i)))} />
                  </Field>
                  <Field label="Answer">
                    <Textarea rows={2} value={faq.answer} onChange={(e) => setAll(items.map((i) => (i.id === faq.id ? { ...i, answer: e.target.value } : i)))} />
                  </Field>
                </div>
                <button onClick={() => setAll(items.filter((i) => i.id !== faq.id))} className="mt-1 text-[#26221C]/30 hover:text-red-500">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </Card>
          )}
        />
      )}
    </div>
  );
}
