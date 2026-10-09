"use client";

import { useState } from "react";
import { Button, HiddenField, Modal, SubmitButton } from "@/components/ui";
import { deleteProduct } from "../actions";

export function DeleteProduct({ id, name }: { id: string; name: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Delete
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Delete this product?"
        description={`“${name}” is removed from your inventory and online store. Past sales keep their record.`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Keep product
            </Button>
            <form action={deleteProduct}>
              <HiddenField name="id" value={id} />
              <SubmitButton variant="danger" pendingText="Deleting…">
                Delete product
              </SubmitButton>
            </form>
          </>
        }
      >
        <p className="text-body text-fg-muted">This can&apos;t be undone.</p>
      </Modal>
    </>
  );
}
