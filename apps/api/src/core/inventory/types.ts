export interface InventoryListItem {
  id: string;
  name: string;
  skuCode: string | null;
  stock: number;
  product: {
    id: string;
    name: string;
  };
}
