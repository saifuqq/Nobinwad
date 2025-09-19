// Cart validation and order submission

// Validate customer information
function validateCustomerInfo() {
    const customerName = document.getElementById('customerName').value.trim();
    const customerPhone = document.getElementById('customerPhone').value.trim();
    const customerAddress = document.getElementById('customerAddress').value.trim();

    if (!customerName || !customerPhone || !customerAddress) {
        showToast('กรุณากรอกข้อมูลให้ครบถ้วน', 'error');
        return false;
    }

    // Validate phone number format (10 digits)
    if (!/^[0-9]{10}$/.test(customerPhone)) {
        showToast('กรุณากรอกเบอร์โทรศัพท์ให้ถูกต้อง (10 หลัก)', 'error');
        return false;
    }

    return true;
}

// Show order confirmation dialog
function showOrderConfirmation() {
    const customerName = document.getElementById('customerName').value.trim();
    const customerPhone = document.getElementById('customerPhone').value.trim();
    const customerAddress = document.getElementById('customerAddress').value.trim();

    // Update confirmation details
    const confirmOrderDetails = document.getElementById('confirmOrderDetails');
    if (confirmOrderDetails) {
        confirmOrderDetails.innerHTML = `
            <div class="space-y-2">
                <p><strong>ชื่อ-นามสกุล:</strong> ${customerName}</p>
                <p><strong>เบอร์โทรศัพท์:</strong> ${customerPhone}</p>
                <p><strong>ที่อยู่จัดส่ง:</strong> ${customerAddress}</p>
            </div>
        `;
    }

    // Update order items
    const confirmOrderItems = document.getElementById('confirmOrderItems');
    if (confirmOrderItems) {
        const itemsList = cart.map(item => `
            <div class="flex justify-between items-center">
                <span>${item.name} (${item.variant || 'ทั่วไป'}) x ${item.quantity}</span>
                <span>${(item.price * item.quantity).toLocaleString()} บาท</span>
            </div>
        `).join('');
        confirmOrderItems.innerHTML = itemsList;
    }

    // Update total
    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const shippingCost = 50; // ค่าจัดส่งคงที่
    const finalTotal = total + shippingCost;
    
    const confirmOrderTotal = document.getElementById('confirmOrderTotal');
    if (confirmOrderTotal) {
        confirmOrderTotal.innerHTML = `${finalTotal.toLocaleString()} บาท`;
    }

    // Show confirmation dialog
    const orderConfirmDialog = document.getElementById('orderConfirmDialog');
    if (orderConfirmDialog) {
        orderConfirmDialog.classList.remove('hidden');
        orderConfirmDialog.classList.add('flex');
    }
}

// Validate and show confirmation
function validateAndConfirmOrder() {
    if (validateCustomerInfo()) {
        showOrderConfirmation();
    }
}

// Submit final order
async function submitFinalOrder() {
    try {
        showToast('กำลังดำเนินการสั่งซื้อ...', 'info');

        const orderData = {
            customerName: document.getElementById('customerName').value.trim(),
            customerPhone: document.getElementById('customerPhone').value.trim(),
            customerAddress: document.getElementById('customerAddress').value.trim(),
            items: cart,
            total: cart.reduce((sum, item) => sum + (item.price * item.quantity), 0),
            shippingCost: 50,
            orderDate: new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })
        };

        // Submit to Google Sheets
        await submitToGoogleSheets(orderData);
        
        // Send LINE notification
        await sendLineNotification(orderData);

        // Clear cart and reset form
        cart = [];
        localStorage.removeItem('cart');
        document.getElementById('orderForm').reset();
        
        // Close all modals
        closeOrderConfirmDialog();
        toggleCart();
        
        // Show success message
        showToast('สั่งซื้อสำเร็จ! ขอบคุณที่ใช้บริการ', 'success');
        
        // Update cart UI
        updateCartUI();

    } catch (error) {
        console.error('Error submitting order:', error);
        showToast('เกิดข้อผิดพลาดในการสั่งซื้อ กรุณาลองใหม่อีกครั้ง', 'error');
    }
}

// Cancel order
function cancelOrder() {
    document.getElementById('shippingForm').classList.add('hidden');
    document.getElementById('cartFooter').classList.remove('hidden');
    document.getElementById('orderForm').reset();
    showToast('ยกเลิกการสั่งซื้อแล้ว', 'info');
}

// Close confirmation dialog
function closeOrderConfirmDialog() {
    const dialog = document.getElementById('orderConfirmDialog');
    if (dialog) {
        dialog.classList.remove('flex');
        dialog.classList.add('hidden');
    }
}

// Export functions
window.validateAndConfirmOrder = validateAndConfirmOrder;
window.submitFinalOrder = submitFinalOrder;
window.cancelOrder = cancelOrder;
window.closeOrderConfirmDialog = closeOrderConfirmDialog;