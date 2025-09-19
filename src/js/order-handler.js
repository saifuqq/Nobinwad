// Google Sheet configuration
const GOOGLE_SHEET_ID = '15spXyebHR8b-OfvG-nbla4RhX1ZMpiN15htaWcPOOTQ';
const SHEET_NAME = 'Orders'; // ชื่อชีตที่จะบันทึกข้อมูล

// Function to validate form data
function validateOrderForm() {
    const customerName = document.getElementById('customerName').value.trim();
    const customerPhone = document.getElementById('customerPhone').value.trim();
    const customerAddress = document.getElementById('customerAddress').value.trim();

    if (!customerName || !customerPhone || !customerAddress) {
        showToast('กรุณากรอกข้อมูลให้ครบถ้วน', 'error');
        return false;
    }

    if (!/^\d{10}$/.test(customerPhone)) {
        showToast('กรุณากรอกเบอร์โทรศัพท์ให้ถูกต้อง (10 หลัก)', 'error');
        return false;
    }

    return true;
}

// Function to get cart items as formatted string
function getCartItemsAsString(cart) {
    return cart.map(item => `${item.name} (${item.price} บาท)`).join('\n');
}

// Function to show order confirmation dialog
function showOrderConfirmation() {
    if (!validateOrderForm()) return;

    const customerName = document.getElementById('customerName').value.trim();
    const customerPhone = document.getElementById('customerPhone').value.trim();
    const customerAddress = document.getElementById('customerAddress').value.trim();
    
    // Update confirmation dialog content
    const confirmDetails = document.getElementById('confirmOrderDetails');
    confirmDetails.innerHTML = `
        <p><strong>ชื่อ-นามสกุล:</strong> ${customerName}</p>
        <p><strong>เบอร์โทรศัพท์:</strong> ${customerPhone}</p>
        <p><strong>ที่อยู่:</strong> ${customerAddress}</p>
    `;

    // Update order items
    const confirmItems = document.getElementById('confirmOrderItems');
    const itemsList = cart.map(item => `
        <div class="flex justify-between">
            <span>${item.name}</span>
            <span>${item.price} บาท</span>
        </div>
    `).join('');
    confirmItems.innerHTML = itemsList;

    // Update total
    const total = cart.reduce((sum, item) => sum + parseFloat(item.price), 0);
    document.getElementById('confirmOrderTotal').innerText = `${total.toLocaleString()} บาท`;

    // Show confirmation dialog
    document.getElementById('orderConfirmDialog').classList.remove('hidden');
    document.getElementById('orderConfirmDialog').classList.add('flex');
}

// Function to close order confirmation dialog
function closeOrderConfirmDialog() {
    document.getElementById('orderConfirmDialog').classList.remove('flex');
    document.getElementById('orderConfirmDialog').classList.add('hidden');
}

// Import LINE messaging functions
import { sendLineNotification } from '../line-api/line-messaging.js';

// Function to submit order to Google Sheets
async function submitOrder() {
    try {
        // Show loading message
        showToast('กำลังดำเนินการบันทึกคำสั่งซื้อ...', 'info');
        
        const customerName = document.getElementById('customerName').value.trim();
        const customerPhone = document.getElementById('customerPhone').value.trim();
        const customerAddress = document.getElementById('customerAddress').value.trim();
        
        // Validate data again before submission
        if (!validateOrderForm()) {
            return;
        }

        // Calculate total and shipping
        const subtotal = cart.reduce((sum, item) => sum + parseFloat(item.price), 0);
        const shippingCost = 50; // ค่าจัดส่งคงที่
        const total = subtotal + shippingCost;

        // Format cart items for sheet
        const cartItemsFormatted = cart.map(item => ({
            name: item.name,
            price: item.price,
            quantity: 1
        }));

        // Prepare order data according to specified column order
        const orderData = {
            timestamp: new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }),
            customerName: customerName,
            customerPhone: customerPhone,
            customerAddress: customerAddress,
            productNames: cart.map(item => item.name).join(", "), // Join all product names with comma
            subtotal: subtotal,
            shipping: shippingCost,
            total: total
        };

        // Google Apps Script Web App URL
        const scriptURL = 'https://script.google.com/macros/s/AKfycbyzr89EtoooLrbzR2qq903Ej1jomDDZTPIJDaFwUDowZdKbPL_QRcw1K6PK3mSs1abqkA/exec';

        // Create form data
        const formData = new FormData();
        Object.keys(orderData).forEach(key => {
            formData.append(key, orderData[key]);
        });
        formData.append('sheetId', GOOGLE_SHEET_ID);
        formData.append('sheetName', SHEET_NAME);

        // Send data using fetch with form-data
        const response = await fetch(scriptURL, {
            method: 'POST',
            mode: 'no-cors', // Important for Google Apps Script
            body: formData
        });

        // Since mode is no-cors, we can't check response.ok
        // Instead, we'll assume success if no error is thrown
        
        // Close dialogs and show success message
        closeOrderConfirmDialog();
        showToast('บันทึกคำสั่งซื้อเรียบร้อยแล้ว 🎉', 'success');
        
        // Clear cart and reset form
        cart = [];
        localStorage.removeItem('cart');
        document.getElementById('orderForm').reset();
        
        // Update UI
        renderCart();
        toggleCart();

        // Log success for debugging
        console.log('Order submitted successfully:', orderData);

    } catch (error) {
        console.error('Error submitting order:', error);
        showToast('เกิดข้อผิดพลาดในการบันทึกคำสั่งซื้อ: ' + error.message, 'error');
        
        // Additional error logging
        const errorDetails = {
            message: error.message,
            timestamp: new Date().toISOString(),
            cartItems: cart.length
        };
        console.error('Detailed error:', errorDetails);
    }
}

// Function to validate and show confirmation
function validateAndConfirmOrder() {
    if (validateOrderForm()) {
        showOrderConfirmation();
    }
}

// Function to cancel order
function cancelOrder() {
    document.getElementById('orderForm').reset();
    document.getElementById('shippingForm').classList.add('hidden');
    showToast('ยกเลิกการสั่งซื้อแล้ว', 'info');
}

// Function to show shipping form
function showShippingForm() {
    if (cart.length === 0) {
        showToast('กรุณาเลือกสินค้าก่อนดำเนินการสั่งซื้อ', 'warning');
        return;
    }
    
    document.getElementById('shippingForm').classList.remove('hidden');
    document.getElementById('cartFooter').classList.add('hidden');
    
    // Update form cart total
    const total = cart.reduce((sum, item) => sum + parseFloat(item.price), 0);
    document.getElementById('formCartTotal').innerText = `${total.toLocaleString()} บาท`;
}