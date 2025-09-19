// Google Sheets submission handler
const GOOGLE_SHEET_ID = '15spXyebHR8b-OfvG-nbla4RhX1ZMpiN15htaWcPOOTQ';
const SHEET_NAME = 'Orders';

// Function to submit data to Google Sheets
async function submitToGoogleSheets(orderData) {
    try {
        // Create Apps Script endpoint URL
        const scriptURL = 'https://script.google.com/macros/s/AKfycbxCgqtT2jAaO-oA7tym23zM3xi2mtzrxH9_BjhIkUzboDs03rSICN3MYkMOWy5I3qwMeg/exec';

        // Prepare the order items string
        const orderItemsString = orderData.items.map(item => 
            `${item.fullProductName || `${item.name} - ${item.variant}`} x ${item.quantity} = ${(item.price * item.quantity).toLocaleString()} บาท`
        ).join('\n');

        // Format the data for sheets
        const formattedData = {
            timestamp: new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }),
            customerName: orderData.customerName,
            customerPhone: orderData.customerPhone,
            customerAddress: orderData.customerAddress,
            productNames: orderData.items.map(item => item.name).join(', '), // เพิ่มการบันทึกชื่อสินค้าแยก
            orderItems: orderItemsString, // รายละเอียดทั้งหมดของสินค้า
            subtotal: orderData.total,
            shippingCost: orderData.shippingCost,
            totalAmount: orderData.total + orderData.shippingCost,
            status: 'รอดำเนินการ'
        };

        // Log the data being sent
        console.log('Sending order data:', formattedData);

        // Create form data
        const formData = new URLSearchParams();
        formData.append('sheetId', GOOGLE_SHEET_ID);
        formData.append('sheetName', SHEET_NAME);
        Object.keys(formattedData).forEach(key => {
            formData.append(key, formattedData[key].toString());
        });

        // Send data to Google Sheets
        const response = await fetch(scriptURL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: formData.toString()
        });

        const result = await response.json();
        console.log('Sheets response:', result);

        if (!result.success) {
            throw new Error(result.error || 'Failed to submit order');
        }

        return true;
    } catch (error) {
        console.error('Error submitting to Google Sheets:', error);
        throw new Error('ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหม่อีกครั้ง');
    }
}

// Function to handle final order submission
async function submitFinalOrder() {
    try {
        // Show loading state
        showToast('กำลังดำเนินการบันทึกคำสั่งซื้อ...', 'info');
        
        // Get order data
        const orderData = {
            customerName: document.getElementById('customerName').value.trim(),
            customerPhone: document.getElementById('customerPhone').value.trim(),
            customerAddress: document.getElementById('customerAddress').value.trim(),
            items: cart,
            total: cart.reduce((sum, item) => sum + (item.price * item.quantity), 0),
            shippingCost: 50
        };

        // Submit to Google Sheets
        await submitToGoogleSheets(orderData);

        // Clear cart and reset form
        cart = [];
        localStorage.removeItem('cart');
        document.getElementById('orderForm').reset();
        
        // Close dialogs
        closeOrderConfirmDialog();
        toggleCart();
        
        // Show success message
        showToast('บันทึกคำสั่งซื้อเรียบร้อยแล้ว! 🎉', 'success');
        
        // Update cart UI
        updateCartUI();

    } catch (error) {
        console.error('Error in final order submission:', error);
        showToast(error.message || 'เกิดข้อผิดพลาดในการสั่งซื้อ กรุณาลองใหม่อีกครั้ง', 'error');
    }
}

// Update the order confirmation dialog
function showOrderConfirmation() {
    if (!validateCustomerInfo()) return;

    const orderData = {
        customerName: document.getElementById('customerName').value.trim(),
        customerPhone: document.getElementById('customerPhone').value.trim(),
        customerAddress: document.getElementById('customerAddress').value.trim(),
        items: cart,
        total: cart.reduce((sum, item) => sum + (item.price * item.quantity), 0),
        shippingCost: 50
    };

    // Update confirmation dialog content
    const dialog = document.getElementById('orderConfirmDialog');
    const details = document.getElementById('confirmOrderDetails');
    const items = document.getElementById('confirmOrderItems');
    const total = document.getElementById('confirmOrderTotal');

    if (details && items && total) {
        // Show customer details
        details.innerHTML = `
            <div class="space-y-2 text-gray-700 dark:text-gray-300">
                <p><strong>ชื่อ-นามสกุล:</strong> ${orderData.customerName}</p>
                <p><strong>เบอร์โทรศัพท์:</strong> ${orderData.customerPhone}</p>
                <p><strong>ที่อยู่จัดส่ง:</strong> ${orderData.customerAddress}</p>
            </div>
        `;

        // Show order items
        items.innerHTML = orderData.items.map(product => `
            <div class="flex justify-between items-center py-1">
                <span>${product.fullProductName || `${product.name} - ${product.variant}`} x ${product.quantity}</span>
                <span>${(product.price * product.quantity).toLocaleString()} บาท</span>
            </div>
        `).join('');

        // Show total with shipping
        const finalTotal = orderData.total + orderData.shippingCost;
        total.innerHTML = `
            <div class="flex justify-between items-center text-sm mb-2">
                <span>ราคาสินค้ารวม:</span>
                <span>${orderData.total.toLocaleString()} บาท</span>
            </div>
            <div class="flex justify-between items-center text-sm mb-2">
                <span>ค่าจัดส่ง:</span>
                <span>${orderData.shippingCost.toLocaleString()} บาท</span>
            </div>
            <div class="flex justify-between items-center font-bold text-lg text-pink-600">
                <span>ยอดรวมทั้งสิ้น:</span>
                <span>${finalTotal.toLocaleString()} บาท</span>
            </div>
        `;

        // Show dialog
        dialog.classList.remove('hidden');
        dialog.classList.add('flex');
    }
}

// Export functions
window.submitFinalOrder = submitFinalOrder;
window.showOrderConfirmation = showOrderConfirmation;