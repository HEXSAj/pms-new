'use client';

import { useState, FormEvent, useEffect } from 'react';
import { X, Save, Loader2 } from 'lucide-react';
import { ref, update, onValue, off } from 'firebase/database';
import { database } from '@/lib/firebase';

interface Category {
  id: string;
  name: string;
  description: string | null;
}

interface InventoryItem {
  id: string;
  tradeName: string;
  genericName: string | null;
  costPrice: number;
  sellingPrice: number;
  currentStock: number;
  minimumStock: number;
  brandName: string | null;
  category: string | null;
  notes: string | null;
  discountPrevented: boolean;
  createdAt: string;
  updatedAt: string;
}

interface EditInventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  item: InventoryItem | null;
}

export default function EditInventoryModal({
  isOpen,
  onClose,
  onSuccess,
  item,
}: EditInventoryModalProps) {
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [formData, setFormData] = useState({
    tradeName: '',
    genericName: '',
    costPrice: '',
    sellingPrice: '',
    currentStock: '',
    minimumStock: '',
    brandName: '',
    category: '',
    notes: '',
    discountPrevented: false,
  });

  // Fetch categories from Firebase
  useEffect(() => {
    if (!isOpen) return;

    const categoriesRef = ref(database, 'categories');
    
    const unsubscribe = onValue(categoriesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const cats: Category[] = Object.keys(data).map((key) => ({
          id: key,
          ...data[key],
        }));
        setCategories(cats);
      } else {
        setCategories([]);
      }
    });

    return () => {
      off(categoriesRef);
    };
  }, [isOpen]);

  // Populate form when item changes
  useEffect(() => {
    if (item) {
      setFormData({
        tradeName: item.tradeName || '',
        genericName: item.genericName || '',
        costPrice: item.costPrice?.toString() || '',
        sellingPrice: item.sellingPrice?.toString() || '',
        currentStock: item.currentStock?.toString() || '',
        minimumStock: item.minimumStock?.toString() || '',
        brandName: item.brandName || '',
        category: item.category || '',
        notes: item.notes || '',
        discountPrevented: item.discountPrevented || false,
      });
    }
  }, [item]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!item) return;

    setLoading(true);

    try {
      // Create updated inventory item object
      const updatedItem = {
        tradeName: formData.tradeName.trim(),
        genericName: formData.genericName.trim() || null,
        costPrice: parseFloat(formData.costPrice) || 0,
        sellingPrice: parseFloat(formData.sellingPrice) || 0,
        currentStock: parseInt(formData.currentStock) || 0,
        minimumStock: parseInt(formData.minimumStock) || 0,
        brandName: formData.brandName.trim() || null,
        category: formData.category || null,
        notes: formData.notes.trim() || null,
        discountPrevented: formData.discountPrevented,
        updatedAt: new Date().toISOString(),
        // Preserve createdAt
        createdAt: item.createdAt,
      };

      // Update in Firebase Realtime Database
      const itemRef = ref(database, `inventory/${item.id}`);
      await update(itemRef, updatedItem);

      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error updating inventory item:', error);
      alert('Failed to update inventory item. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleToggle = () => {
    setFormData((prev) => ({
      ...prev,
      discountPrevented: !prev.discountPrevented,
    }));
  };

  if (!isOpen || !item) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            Edit Medicine
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            <X className="w-5 h-5 text-slate-600 dark:text-slate-400" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Trade Name */}
            <div className="md:col-span-2">
              <label
                htmlFor="tradeName"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
              >
                Trade Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="tradeName"
                name="tradeName"
                value={formData.tradeName}
                onChange={handleChange}
                required
                placeholder="Enter trade name of medicine"
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400"
              />
            </div>

            {/* Generic Name */}
            <div>
              <label
                htmlFor="genericName"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
              >
                Generic Name
              </label>
              <input
                type="text"
                id="genericName"
                name="genericName"
                value={formData.genericName}
                onChange={handleChange}
                placeholder="Enter generic name (optional)"
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400"
              />
            </div>

            {/* Brand Name */}
            <div>
              <label
                htmlFor="brandName"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
              >
                Brand Name
              </label>
              <input
                type="text"
                id="brandName"
                name="brandName"
                value={formData.brandName}
                onChange={handleChange}
                placeholder="Enter brand name (optional)"
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400"
              />
            </div>

            {/* Category */}
            <div>
              <label
                htmlFor="category"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
              >
                Category
              </label>
              <select
                id="category"
                name="category"
                value={formData.category}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
              >
                <option value="">Select Category</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Cost Price */}
            <div>
              <label
                htmlFor="costPrice"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
              >
                Cost Price (per unit) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                id="costPrice"
                name="costPrice"
                value={formData.costPrice}
                onChange={handleChange}
                required
                min="0"
                step="0.01"
                placeholder="0.00"
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400"
              />
            </div>

            {/* Selling Price */}
            <div>
              <label
                htmlFor="sellingPrice"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
              >
                Selling Price (per unit) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                id="sellingPrice"
                name="sellingPrice"
                value={formData.sellingPrice}
                onChange={handleChange}
                required
                min="0"
                step="0.01"
                placeholder="0.00"
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400"
              />
            </div>

            {/* Current Stock */}
            <div>
              <label
                htmlFor="currentStock"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
              >
                Current Stock <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                id="currentStock"
                name="currentStock"
                value={formData.currentStock}
                onChange={handleChange}
                required
                min="0"
                placeholder="0"
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400"
              />
            </div>

            {/* Minimum Stock */}
            <div>
              <label
                htmlFor="minimumStock"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
              >
                Minimum Stock Level <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                id="minimumStock"
                name="minimumStock"
                value={formData.minimumStock}
                onChange={handleChange}
                required
                min="0"
                placeholder="0"
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400"
              />
            </div>

            {/* Discount Prevented */}
            <div>
              <label
                htmlFor="discountPrevented"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
              >
                Discount Prevented
              </label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleToggle}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    formData.discountPrevented
                      ? 'bg-blue-600'
                      : 'bg-slate-300 dark:bg-slate-600'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      formData.discountPrevented ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
                <span className="text-sm text-slate-600 dark:text-slate-400">
                  {formData.discountPrevented ? 'Yes' : 'No'}
                </span>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label
              htmlFor="notes"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
            >
              Notes
            </label>
            <textarea
              id="notes"
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows={3}
              placeholder="Add any additional notes (optional)"
              className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Update Medicine
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

