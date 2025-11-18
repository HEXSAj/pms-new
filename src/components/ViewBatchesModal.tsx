'use client';

import { useState, useEffect } from 'react';
import { X, Calendar, Package, DollarSign } from 'lucide-react';
import { ref, onValue, off } from 'firebase/database';
import { database } from '@/lib/firebase';

interface Batch {
  id: string;
  itemId: string;
  purchaseId: string;
  quantity: number;
  costPrice: number; // in cents
  sellingPrice: number; // in cents
  expiryDate: string | null;
  createdAt: string;
  isInitialStock?: boolean;
}

interface ViewBatchesModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemId: string;
  itemName: string;
}

export default function ViewBatchesModal({
  isOpen,
  onClose,
  itemId,
  itemName,
}: ViewBatchesModalProps) {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen || !itemId) return;

    setLoading(true);
    const batchesRef = ref(database, 'batches');
    
    const unsubscribe = onValue(batchesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const allBatches: Batch[] = Object.keys(data)
          .map((key) => ({
            id: key,
            ...data[key],
          }))
          .filter((batch) => batch.itemId === itemId);
        
        // Sort by expiry date (earliest first)
        allBatches.sort((a, b) => 
          new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime()
        );
        
        setBatches(allBatches);
      } else {
        setBatches([]);
      }
      setLoading(false);
    });

    return () => {
      off(batchesRef);
      setLoading(false);
    };
  }, [isOpen, itemId]);

  const totalQuantity = batches.reduce((sum, batch) => sum + batch.quantity, 0);
  const totalCost = batches.reduce(
    (sum, batch) => sum + batch.quantity * batch.costPrice,
    0
  );
  const averageCostPrice = totalQuantity > 0 ? totalCost / totalQuantity / 100 : 0;

  // Check for expired batches
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiredBatches = batches.filter((batch) => {
    if (!batch.expiryDate) return false;
    return new Date(batch.expiryDate) < today;
  });
  const expiringSoonBatches = batches.filter((batch) => {
    if (!batch.expiryDate) return false;
    const expiryDate = new Date(batch.expiryDate);
    const daysUntilExpiry = Math.ceil(
      (expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );
    return daysUntilExpiry >= 0 && daysUntilExpiry <= 30;
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
              Batches for {itemName}
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Total Stock: {totalQuantity} units
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            <X className="w-5 h-5 text-slate-600 dark:text-slate-400" />
          </button>
        </div>

        {/* Stats */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-slate-200 dark:border-slate-600">
              <div className="flex items-center gap-2 mb-1">
                <Package className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <p className="text-xs text-slate-600 dark:text-slate-400">Total Batches</p>
              </div>
              <p className="text-xl font-bold text-slate-900 dark:text-white">
                {batches.length}
              </p>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-slate-200 dark:border-slate-600">
              <div className="flex items-center gap-2 mb-1">
                <Package className="w-4 h-4 text-green-600 dark:text-green-400" />
                <p className="text-xs text-slate-600 dark:text-slate-400">Total Quantity</p>
              </div>
              <p className="text-xl font-bold text-slate-900 dark:text-white">
                {totalQuantity}
              </p>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-slate-200 dark:border-slate-600">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <p className="text-xs text-slate-600 dark:text-slate-400">Avg. Cost Price</p>
              </div>
              <p className="text-xl font-bold text-slate-900 dark:text-white">
                Rs {averageCostPrice.toFixed(2)}
              </p>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-slate-200 dark:border-slate-600">
              <div className="flex items-center gap-2 mb-1">
                <Calendar className="w-4 h-4 text-red-600 dark:text-red-400" />
                <p className="text-xs text-slate-600 dark:text-slate-400">Expired/Expiring</p>
              </div>
              <p className="text-xl font-bold text-slate-900 dark:text-white">
                {expiredBatches.length} / {expiringSoonBatches.length}
              </p>
            </div>
          </div>
        </div>

        {/* Batches List */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : batches.length === 0 ? (
            <div className="text-center py-12">
              <Package className="w-16 h-16 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-600 dark:text-slate-400 font-medium">
                No batches found for this item
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-500 mt-1">
                Batches will appear here when you add stock through purchase orders
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Batch ID
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Quantity
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Cost Price
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Selling Price
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Expiry Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {batches.map((batch) => {
                    const isInitialStock = batch.isInitialStock || batch.purchaseId === 'initial_stock';
                    const hasExpiryDate = batch.expiryDate && batch.expiryDate !== null;
                    const expiryDate = hasExpiryDate ? new Date(batch.expiryDate) : null;
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const isExpired = expiryDate ? expiryDate < today : false;
                    const daysUntilExpiry = expiryDate ? Math.ceil(
                      (expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
                    ) : null;
                    const isExpiringSoon = expiryDate && !isExpired && daysUntilExpiry !== null && daysUntilExpiry <= 30;

                    return (
                      <tr
                        key={batch.id}
                        className={`hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors ${
                          isExpired ? 'bg-red-50 dark:bg-red-900/10' : ''
                        } ${isExpiringSoon ? 'bg-yellow-50 dark:bg-yellow-900/10' : ''}
                        ${isInitialStock ? 'bg-blue-50 dark:bg-blue-900/10' : ''}`}
                      >
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="text-sm font-mono text-slate-900 dark:text-white">
                            {batch.id.substring(0, 8)}...
                          </div>
                          {isInitialStock && (
                            <div className="text-xs text-blue-600 dark:text-blue-400 mt-1 font-medium">
                              Initial Stock
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="text-sm text-slate-900 dark:text-white">
                            {batch.quantity}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="text-sm text-slate-900 dark:text-white">
                            Rs {(batch.costPrice / 100).toFixed(2)}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="text-sm font-medium text-slate-900 dark:text-white">
                            Rs {(batch.sellingPrice / 100).toFixed(2)}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {hasExpiryDate && expiryDate ? (
                            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                              <Calendar className="w-4 h-4" />
                              {expiryDate.toLocaleDateString()}
                            </div>
                          ) : (
                            <div className="text-sm text-slate-400 dark:text-slate-500 italic">
                              No expiry date
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {!hasExpiryDate ? (
                            <span className="px-2 py-1 text-xs font-medium rounded-full bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300">
                              No Expiry
                            </span>
                          ) : isExpired ? (
                            <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400">
                              Expired
                            </span>
                          ) : isExpiringSoon ? (
                            <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400">
                              Expires in {daysUntilExpiry} days
                            </span>
                          ) : (
                            <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">
                              Active
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-200 dark:border-slate-700 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-slate-600 hover:bg-slate-700 text-white font-medium rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

