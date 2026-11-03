import { describe, expect, it } from "vitest";
import { makeDeck } from "./hubStore";
import {
  DEFAULT_PILES, addPile, aggregateTaggedCards, angularDistance, assignCustomPile,
  changePile, findRadialTarget, isRightSide, normalizePiles,
} from "./swiperPiles";

const card = (name: string) => ({
  name, quantity: 2, section: "main" as const,
  oracleId: name.toLowerCase(), setCode: "cmm", collectorNumber: "1",
});
describe("radial piles", () => {
  it("provides Main, Sideboard, Maybe, Wishlist, Have and hidden None as defaults", () => {
    const piles = normalizePiles();
    expect(piles.map(p => p.name)).toEqual(["Main","Sideboard","Maybe","Wishlist","Tenho","Nenhum"]);
    expect(piles.find(p => p.id === "none")?.visible).toBe(false);
    expect(piles.find(p => p.id === "owned")?.angle).toBe(0);
  });
  it("selects right side positive destinations and fixed left discard", () => {
    const piles = normalizePiles();
    expect(findRadialTarget(piles, 90, 0)).toBe("sideboard");
    expect(findRadialTarget(piles, 80, -80)).toBe("deck");
    expect(findRadialTarget(piles, -90, 0)).toBe("reject");
    expect(findRadialTarget(piles, -90, 90)).toBe("reject");
    expect(isRightSide(90)).toBe(true);
    expect(isRightSide(270)).toBe(false);
  });
  it("hides conflicting positions without erasing membership or tags", () => {
    let piles = normalizePiles();
    piles = changePile(piles,"wishlist",{angle:45});
    expect(piles.find(p=>p.id==="wishlist")?.visible).toBe(true);
    expect(piles.find(p=>p.id==="deck")?.visible).toBe(false);
    expect(angularDistance(45,360)).toBe(45);
    expect(piles.find(p=>p.id==="deck")?.tag).toBe("main");
    const reserved = changePile(piles,"wishlist",{angle:225,visible:true});
    expect(reserved.find(p=>p.id==="wishlist")?.visible).toBe(false);
  });
  it("keeps the most recent explicit tag and a deleted default deleted", () => {
    let piles = changePile(DEFAULT_PILES,"deck",{name:"My Main",tag:"keepers"});
    piles = changePile(piles,"deck",{angle:60});
    expect(normalizePiles(piles).find(p=>p.id==="deck")?.tag).toBe("keepers");
    piles = changePile(piles,"sideboard",{deleted:true,visible:false});
    expect(normalizePiles(piles).find(p=>p.id==="sideboard")?.deleted).toBe(true);
  });
  it("permits overlapping membership across groups but only one pile within a linked group", () => {
    let piles = addPile(normalizePiles(),{name:"Trade",tag:"trade",angle:180,linkedGroup:"trade"});
    piles = addPile(piles,{name:"Keep",tag:"trade",angle:210,linkedGroup:"trade"});
    const first = piles.find(p=>p.name==="Trade")!;
    const second = piles.find(p=>p.name==="Keep")!;
    piles = assignCustomPile(piles,first.id,card("Sol Ring"));
    piles = assignCustomPile(piles,second.id,card("Sol Ring"));
    expect(piles.find(p=>p.id===first.id)?.cards).toHaveLength(0);
    expect(piles.find(p=>p.id===second.id)?.cards).toHaveLength(1);
    const third = addPile(piles,{name:"Art",angle:240});
    const art = third.find(p=>p.name==="Art")!;
    const final = assignCustomPile(third,art.id,card("Sol Ring"));
    expect(final.find(p=>p.id===second.id)?.cards).toHaveLength(1);
    expect(final.find(p=>p.id===art.id)?.cards).toHaveLength(1);
  });
  it("aggregates tagged piles across decks without duplicating the same card identity", () => {
    const a = makeDeck("A",[card("Sol Ring")]);
    const b = makeDeck("B",[card("Sol Ring"),card("Arcane Signet")]);
    expect(aggregateTaggedCards([a,b],"main").map(c=>c.name).sort())
      .toEqual(["Arcane Signet","Sol Ring"]);
  });
});
