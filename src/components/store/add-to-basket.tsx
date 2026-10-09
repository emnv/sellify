"use client";

import Link from "next/link";
import { useState } from "react";
import { useBasket } from "@/stores/basket";
import { StoreButton, storeButtonClass } from "./ui";

export function AddToBasket({ storeKey, productId, stock, basketHref, disabled }: { storeKey: string; productId: string; stock: number; basketHref: string; disabled?: boolean }) {
  const { lines, add } = useBasket(storeKey);
  const [added, setAdded] = useState(false);
  const inBasket = lines.find((l) => l.productId === productId)?.qty ?? 0;
  const soldOut = stock <= 0;
  const atMax = inBasket >= stock;

  if (soldOut) return <StoreButton disabled full>Sold out</StoreButton>;

  return (
    <div className="flex flex-col gap-3">
      <StoreButton
        full
        disabled={disabled || atMax}
        onClick={() => {
          add(productId, 1, stock);
          setAdded(true);
        }}
      >
        {atMax ? "All available stock is in your basket" : "Add to basket"}
      </StoreButton>
      {disabled ? <p className="text-store-sm text-store-muted">Buying is turned off in the preview.</p> : null}
      {added || inBasket > 0 ? (
        <p role="status" className="text-store-sm">
          {inBasket} in your basket ·{" "}
          <Link href={basketHref} className={`${storeButtonClass("ghost")} px-0 underline`}>
            Go to basket
          </Link>
        </p>
      ) : null}
    </div>
  );
}
