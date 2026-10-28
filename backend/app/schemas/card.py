from pydantic import BaseModel


class CardSearchResult(BaseModel):
    scryfall_id: str
    name: str
    set_name: str
    rarity: str
    type_line: str | None
    image_url: str
