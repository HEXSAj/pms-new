'use client';

import { useState, FormEvent, useEffect } from 'react';
import { X, Save, Loader2, Plus, Trash2, Search, Calendar } from 'lucide-react';
import { ref, push, set, onValue, off } from 'firebase/database';
import { database } from '@/lib/firebase';

interface Supplier {
  id: string;
  name: string;
  companyName: string | null;
}

interface InventoryItem {
  id: string;
  tradeName: string;
  genericName: string | null;
}

interface BatchEntry {
  quantity: string;
  expiryDate: string;
}

interface PurchaseItem {
  itemId: string;
  itemName: string;
  costPrice: string;
  sellingPrice: string;
  batches: BatchEntry[];
}

interface AddPurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddPurchaseModal({
  isOpen,
  onClose,
  onSuccess,
}: AddPurchaseModalProps) {
  const [loading, setLoading] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [purchaseItems, setPurchaseItems] = useState<PurchaseItem[]>([]);
  const [itemSearchQuery, setItemSearchQuery] = useState('');
  const [showItemSearch, setShowItemSearch] = useState(false);
  const [supplierSearchQuery, setSupplierSearchQuery] = useState('');
  const [showSupplierSearch, setShowSupplierSearch] = useState(false);

  // Fetch suppliers
  useEffect(() => {
    if (!isOpen) return;

    const suppliersRef = ref(database, 'suppliers');
    
    const unsubscribe = onValue(suppliersRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const supps: Supplier[] = Object.keys(data).map((key) => ({
          id: key,
          ...data[key],
        }));
        setSuppliers(supps);
      } else {
        setSuppliers([]);
      }
    });

    return () => {
      off(suppliersRef);
    };
  }, [isOpen]);

  // Fetch inventory items
  useEffect(() => {
    if (!isOpen) return;

    const inventoryRef = ref(database, 'inventory');
    
    const unsubscribe = onValue(inventoryRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const items: InventoryItem[] = Object.keys(data).map((key) => ({
          id: key,
          ...data[key],
        }));
        setInventoryItems(items);
      } else {
        setInventoryItems([]);
      }
    });

    return () => {
      off(inventoryRef);
    };
  }, [isOpen]);

  // Filter inventory items for search
  const filteredInventoryItems = inventoryItems.filter((item) => {
    if (!itemSearchQuery) return false;
    const query = itemSearchQuery.toLowerCase();
    return (
      item.tradeName.toLowerCase().includes(query) ||
      (item.genericName && item.genericName.toLowerCase().includes(query))
    );
  });

  // Filter suppliers for search
  const filteredSuppliers = suppliers.filter((supplier) => {
    if (!supplierSearchQuery) return true;
    const query = supplierSearchQuery.toLowerCase();
    return (
      supplier.name.toLowerCase().includes(query) ||
      (supplier.companyName && supplier.companyName.toLowerCase().includes(query))
    );
  });

  const handleAddItem = (item: InventoryItem) => {
    // Check if item already added
    if (purchaseItems.some((pi) => pi.itemId === item.id)) {
      alert('This item is already added to the purchase order.');
      return;
    }

    const newItem: PurchaseItem = {
      itemId: item.id,
      itemName: item.tradeName,
      costPrice: '',
      sellingPrice: '',
      batches: [{ quantity: '', expiryDate: '' }], // Start with one batch entry
    };
    setPurchaseItems([...purchaseItems, newItem]);
    setItemSearchQuery('');
    setShowItemSearch(false);
  };

  const handleRemoveItem = (index: number) => {
    setPurchaseItems(purchaseItems.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: keyof PurchaseItem, value: string) => {
    const updated = [...purchaseItems];
    updated[index] = { ...updated[index], [field]: value };
    setPurchaseItems(updated);
  };

  const handleAddBatch = (itemIndex: number) => {
    const updated = [...purchaseItems];
    updated[itemIndex].batches.push({ quantity: '', expiryDate: '' });
    setPurchaseItems(updated);
  };

  const handleRemoveBatch = (itemIndex: number, batchIndex: number) => {
    const updated = [...purchaseItems];
    if (updated[itemIndex].batches.length > 1) {
      updated[itemIndex].batches.splice(batchIndex, 1);
      setPurchaseItems(updated);
    } else {
      alert('Each item must have at least one batch entry.');
    }
  };

  const handleBatchChange = (itemIndex: number, batchIndex: number, field: keyof BatchEntry, value: string) => {
    const updated = [...purchaseItems];
    updated[itemIndex].batches[batchIndex][field] = value;
    setPurchaseItems(updated);
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!selectedSupplierId) {
      alert('Please select a supplier');
      return;
    }

    if (purchaseItems.length === 0) {
      alert('Please add at least one item to the purchase order');
      return;
    }

    // Validate all items and batches
    for (let i = 0; i < purchaseItems.length; i++) {
      const item = purchaseItems[i];
      const costPrice = parseFloat(item.costPrice);
      const sellingPrice = parseFloat(item.sellingPrice);
      
      if (!item.costPrice || isNaN(costPrice) || costPrice < 0) {
        alert(`Please enter a valid cost price for ${item.itemName}`);
        return;
      }
      if (!item.sellingPrice || isNaN(sellingPrice) || sellingPrice < 0) {
        alert(`Please enter a valid selling price for ${item.itemName}`);
        return;
      }

      // Validate all batches for this item
      if (!item.batches || item.batches.length === 0) {
        alert(`Please add at least one batch entry for ${item.itemName}`);
        return;
      }

      for (let j = 0; j < item.batches.length; j++) {
        const batch = item.batches[j];
        const quantity = parseFloat(batch.quantity);
        
        if (!batch.quantity || isNaN(quantity) || quantity <= 0) {
          alert(`Please enter a valid quantity for batch ${j + 1} of ${item.itemName}`);
          return;
        }
        if (!batch.expiryDate) {
          alert(`Please enter an expiry date for batch ${j + 1} of ${item.itemName}`);
          return;
        }
      }
    }

    setLoading(true);

    try {
      const selectedSupplier = suppliers.find((s) => s.id === selectedSupplierId);
      if (!selectedSupplier) {
        throw new Error('Supplier not found');
      }

      // Create purchase order
      const purchaseRef = ref(database, 'purchases');
      const newPurchaseRef = push(purchaseRef);
      const purchaseId = newPurchaseRef.key!;

      // Calculate total quantity and cost from all batches
      const totalQuantity = purchaseItems.reduce((sum, item) => {
        const itemTotal = item.batches.reduce((batchSum, batch) => 
          batchSum + (parseFloat(batch.quantity) || 0), 0
        );
        return sum + itemTotal;
      }, 0);

      const totalCost = purchaseItems.reduce((sum, item) => {
        const itemTotal = item.batches.reduce((batchSum, batch) => 
          batchSum + (parseFloat(batch.quantity) || 0) * (parseFloat(item.costPrice) || 0) * 100, 0
        );
        return sum + itemTotal;
      }, 0);

      const purchaseData = {
        supplierId: selectedSupplierId,
        supplierName: selectedSupplier.companyName || selectedSupplier.name,
        purchaseDate: purchaseDate,
        totalItems: purchaseItems.length,
        totalQuantity: totalQuantity,
        totalCost: totalCost,
        createdAt: new Date().toISOString(),
      };

      await set(newPurchaseRef, purchaseData);

      // Create batches for each item and each batch entry
      const batchPromises: Promise<void>[] = [];
      
      purchaseItems.forEach((item) => {
        item.batches.forEach((batch) => {
          const batchRef = ref(database, 'batches');
          const newBatchRef = push(batchRef);
          
          const batchData = {
            itemId: item.itemId,
            purchaseId: purchaseId,
            quantity: parseFloat(batch.quantity) || 0,
            costPrice: Math.round((parseFloat(item.costPrice) || 0) * 100), // Store in cents
            sellingPrice: Math.round((parseFloat(item.sellingPrice) || 0) * 100), // Store in cents
            expiryDate: batch.expiryDate,
            createdAt: new Date().toISOString(),
          };

          batchPromises.push(set(newBatchRef, batchData));
        });
      });

      await Promise.all(batchPromises);

      // Reset form
      setSelectedSupplierId('');
      setPurchaseDate(new Date().toISOString().split('T')[0]);
      setPurchaseItems([]);
      setItemSearchQuery('');
      setShowItemSearch(false);
      setSupplierSearchQuery('');
      setShowSupplierSearch(false);

      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error creating purchase order:', error);
      alert('Failed to create purchase order. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            New Purchase Order
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            <X className="w-5 h-5 text-slate-600 dark:text-slate-400" />
          </button>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto">
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Supplier and Date */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label
                  htmlFor="supplier"
                  className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
                >
                  Supplier <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    value={supplierSearchQuery}
                    onChange={(e) => {
                      setSupplierSearchQuery(e.target.value);
                      setShowSupplierSearch(true);
                    }}
                    onFocus={() => {
                      if (!selectedSupplierId) {
                        setShowSupplierSearch(true);
                      }
                    }}
                    onBlur={() => {
                      // Delay to allow click on dropdown item
                      setTimeout(() => setShowSupplierSearch(false), 200);
                    }}
                    placeholder="Search supplier by name or company..."
                    className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400"
                  />
                  {selectedSupplierId && (
                    <div className="mt-2 flex items-center justify-between">
                      <div className="text-sm text-slate-600 dark:text-slate-400">
                        Selected: <span className="font-medium text-slate-900 dark:text-white">
                          {suppliers.find(s => s.id === selectedSupplierId)?.name}
                          {suppliers.find(s => s.id === selectedSupplierId)?.companyName && 
                            ` - ${suppliers.find(s => s.id === selectedSupplierId)?.companyName}`
                          }
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedSupplierId('');
                          setSupplierSearchQuery('');
                        }}
                        className="text-xs text-red-600 dark:text-red-400 hover:underline"
                      >
                        Clear
                      </button>
                    </div>
                  )}
                  {showSupplierSearch && filteredSuppliers.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {filteredSuppliers.map((supplier) => (
                        <button
                          key={supplier.id}
                          type="button"
                          onClick={() => {
                            setSelectedSupplierId(supplier.id);
                            setSupplierSearchQuery('');
                            setShowSupplierSearch(false);
                          }}
                          className="w-full px-4 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors"
                        >
                          <div className="text-sm font-medium text-slate-900 dark:text-white">
                            {supplier.name}
                          </div>
                          {supplier.companyName && (
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              {supplier.companyName}
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label
                  htmlFor="purchaseDate"
                  className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
                >
                  Purchase Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  id="purchaseDate"
                  value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                  required
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                />
              </div>
            </div>

            {/* Add Item Section */}
            <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                  Items
                </h3>
                <button
                  type="button"
                  onClick={() => setShowItemSearch(!showItemSearch)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Item
                </button>
              </div>

              {/* Item Search */}
              {showItemSearch && (
                <div className="mb-4 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    value={itemSearchQuery}
                    onChange={(e) => setItemSearchQuery(e.target.value)}
                    placeholder="Search by trade name or generic name..."
                    className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400"
                  />
                  {itemSearchQuery && filteredInventoryItems.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {filteredInventoryItems.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleAddItem(item)}
                          className="w-full px-4 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors"
                        >
                          <div className="text-sm font-medium text-slate-900 dark:text-white">
                            {item.tradeName}
                          </div>
                          {item.genericName && (
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              {item.genericName}
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Purchase Items List */}
              {purchaseItems.length === 0 ? (
                <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                  No items added. Click "Add Item" to start.
                </div>
              ) : (
                <div className="space-y-4">
                  {purchaseItems.map((item, index) => (
                    <div
                      key={index}
                      className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg p-4"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="font-medium text-slate-900 dark:text-white">
                          {item.itemName}
                        </h4>
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(index)}
                          className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      {/* Cost and Selling Price (shared for all batches) */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Cost Price (Rs) <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.costPrice}
                            onChange={(e) =>
                              handleItemChange(index, 'costPrice', e.target.value)
                            }
                            required
                            placeholder="0.00"
                            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Selling Price (Rs) <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.sellingPrice}
                            onChange={(e) =>
                              handleItemChange(index, 'sellingPrice', e.target.value)
                            }
                            required
                            placeholder="0.00"
                            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm"
                          />
                        </div>
                      </div>

                      {/* Batches Section */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                            Batches (Quantity & Expiry Date) <span className="text-red-500">*</span>
                          </label>
                          <button
                            type="button"
                            onClick={() => handleAddBatch(index)}
                            className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-1"
                          >
                            <Plus className="w-3 h-3" />
                            Add Batch
                          </button>
                        </div>
                        
                        {item.batches.map((batch, batchIndex) => (
                          <div
                            key={batchIndex}
                            className="flex items-start gap-2 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600"
                          >
                            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                                  Quantity <span className="text-red-500">*</span>
                                </label>
                                <input
                                  type="number"
                                  min="1"
                                  value={batch.quantity}
                                  onChange={(e) =>
                                    handleBatchChange(index, batchIndex, 'quantity', e.target.value)
                                  }
                                  required
                                  placeholder="0"
                                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                                  Expiry Date <span className="text-red-500">*</span>
                                </label>
                                <div className="relative">
                                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                  <input
                                    type="date"
                                    value={batch.expiryDate}
                                    onChange={(e) =>
                                      handleBatchChange(index, batchIndex, 'expiryDate', e.target.value)
                                    }
                                    required
                                    className="w-full pl-10 pr-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm"
                                  />
                                </div>
                              </div>
                            </div>
                            {item.batches.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveBatch(index, batchIndex)}
                                className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors mt-6"
                                title="Remove batch"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        ))}
                        
                        {/* Total Quantity Display */}
                        <div className="text-xs text-slate-600 dark:text-slate-400 mt-2">
                          Total Quantity: <span className="font-medium text-slate-900 dark:text-white">
                            {item.batches.reduce((sum, batch) => sum + (parseFloat(batch.quantity) || 0), 0)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 font-medium rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || purchaseItems.length === 0}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Create Purchase Order
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

