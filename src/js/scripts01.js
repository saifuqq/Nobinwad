// Initialize cart if it doesn't exist
if (!window.cart) {
    window.cart = [];
}

/**
 * Show order form modal
 */
function showOrderForm() {
    try {
        console.log('Opening order form...'); // Debug log
        
        if (!Array.isArray(window.cart) || window.cart.length === 0) {
            showToast('กรุณาเพิ่มสินค้าในตะกร้าก่อนสั่งซื้อ', 'warning');
            return;
        }

        const modal = document.getElementById('orderFormModal');
        const summaryList = document.getElementById('orderSummaryList');
        const orderForm = document.getElementById('orderForm');

        if (!modal || !summaryList || !orderForm) {
            console.error('Order form elements not found:', { modal, summaryList, orderForm });
            showToast('เกิดข้อผิดพลาดในการแสดงแบบฟอร์ม', 'error');
            return;
        }

        // Clear previous form data
        orderForm.reset();

        // Calculate totals
        const totalQuantity = cart.reduce((sum, item) => sum + item.quantity, 0);
        const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const shippingCost = calculateShippingCost(totalQuantity);
        const total = subtotal + shippingCost;

        // Update order summary with all cost breakdowns
        summaryList.innerHTML = `
            <div class="space-y-4">
                ${cart.map(item => `
                    <div class="flex justify-between items-center p-2 border-b dark:border-gray-700">
                        <div>
                            <p class="font-medium">${item.name}</p>
                            <p class="text-sm text-gray-600 dark:text-gray-400">${item.variant || 'ทั่วไป'} x ${item.quantity}</p>
                        </div>
                        <p class="font-medium">${(item.price * item.quantity).toLocaleString()} บาท</p>
                    </div>
                `).join('')}
                
                <div class="mt-4 space-y-2 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div class="flex justify-between text-gray-600 dark:text-gray-400">
                        <span>ราคาสินค้ารวม:</span>
                        <span>${subtotal.toLocaleString()} บาท</span>
                    </div>
                    <div class="flex justify-between text-gray-600 dark:text-gray-400">
                        <span>ค่าจัดส่ง (${totalQuantity} ชิ้น):</span>
                        <span>${shippingCost.toLocaleString()} บาท</span>
                    </div>
                    <div class="flex justify-between font-bold text-lg pt-2 border-t dark:border-gray-700">
                        <span>ยอดรวมทั้งสิ้น:</span>
                        <span class="text-pink-600">${total.toLocaleString()} บาท</span>
                    </div>
                </div>
            </div>
        `;

        // Show modal with animation
        modal.classList.remove('hidden');
        document.body.classList.add('overflow-hidden');
        
        // Close cart modal if it's open
        const cartModal = document.getElementById('cartModal');
        if (cartModal && !cartModal.classList.contains('hidden')) {
            toggleCart();
        }
    } catch (error) {
        console.error('Error showing order form:', error);
        showToast('เกิดข้อผิดพลาดในการแสดงแบบฟอร์ม', 'error');
    }
}