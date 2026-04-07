let user=sessionStorage.getItem('currentUser');
if(!user){
    window.location.href = '../Login and Register Pages/Login.html';
}

document.addEventListener('DOMContentLoaded', () => {
    const tableBody = document.getElementById('assets-table-body');
    const totalProfitVal = document.getElementById('total-profit-value');
    const totalProfitPer = document.getElementById('total-profit-percent');
    const totalValueDisplay = document.getElementById('total-portfolio-value');
    const assetForm = document.getElementById('assetForm');
    const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');

    let myAssets = JSON.parse(localStorage.getItem('userGoldAssets')) || [];
    let deleteIndex = null; // To track which item we want to delete

    function renderAssets() {
        const matePrice = parseFloat(localStorage.getItem('currentPrice')) || 0;

        if (matePrice === 0) {
            totalValueDisplay.innerText = "Waiting for price...";
            return; 
        }

        tableBody.innerHTML = '';
        let portfolioTotalValue = 0;
        let totalPurchaseCost = 0;

        myAssets.forEach((asset, index) => {
            const gramPrice24k = matePrice / 31.1035;
            const kFactor = parseInt(asset.karat) / 24;
            const currentGramPrice = gramPrice24k * kFactor;
            
            const marketValue = currentGramPrice * parseFloat(asset.weight);
            const purchasePrice = parseFloat(asset.price);
            const profitLoss = marketValue - purchasePrice;
            
            portfolioTotalValue += marketValue;
            totalPurchaseCost += purchasePrice;

            const colorClass = profitLoss >= 0 ? 'profit-pos' : 'profit-neg';

            tableBody.innerHTML += `
                <tr>
                    <td>
                        <div class="d-flex align-items-center">
                            <div class="p-2 bg-dark rounded-3 me-3"> ${
        asset.image 
        ? `<img src="${asset.image}" style="width:40px;height:40px;object-fit:cover;border-radius:6px;">`
        : `<i class="bi bi-gem text-warning"></i>`
    }</i></div>
                            <div>
                                <p class="mb-0 fw-bold">${asset.category}</p>
                                <small class="text-secondary">${asset.type}</small>
                            </div>
                        </div>
                    </td>
                    <td><span class="badge bg-secondary opacity-50">${asset.karat}K</span></td>
                    <td>${asset.weight}g</td>
                    <td>${asset.date}</td>
                    <td>$${purchasePrice.toLocaleString()}</td>
                    <td class="${colorClass} fw-bold">
                        ${profitLoss >= 0 ? '+' : '-'}$${Math.abs(profitLoss).toFixed(2)}
                    </td>
                    <td class="text-end">
                        <button class="btn btn-link text-danger p-0" onclick="prepareDelete(${index})" data-bs-toggle="modal" data-bs-target="#deleteConfirmModal">
                            <i class="bi bi-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        });

        const netProfit = portfolioTotalValue - totalPurchaseCost;
        const netPercent = totalPurchaseCost > 0 ? (netProfit / totalPurchaseCost) * 100 : 0;

        totalValueDisplay.innerText = `$${portfolioTotalValue.toLocaleString(undefined, {minimumFractionDigits: 2})}`;
        totalProfitVal.innerText = `${netProfit >= 0 ? '+' : '-'}$${Math.abs(netProfit).toLocaleString(undefined, {minimumFractionDigits: 2})}`;
        totalProfitVal.className = `stat-value ${netProfit >= 0 ? 'profit-pos' : 'profit-neg'}`;
        
        totalProfitPer.innerText = `${netPercent.toFixed(2)}%`;
        totalProfitPer.className = `badge rounded-pill ms-2 ${netProfit >= 0 ? 'bg-success' : 'bg-danger'}`;
    }

    // --- DELETE LOGIC ---
    // This makes the index available globally so the modal knows what to delete
    window.prepareDelete = function(index) {
        deleteIndex = index;
    };

    confirmDeleteBtn.addEventListener('click', () => {
        if (deleteIndex !== null) {
            myAssets.splice(deleteIndex, 1); // Remove from array
            localStorage.setItem('userGoldAssets', JSON.stringify(myAssets)); // Save update
            
            // Close the modal
            const modalElement = document.getElementById('deleteConfirmModal');
            const modalInstance = bootstrap.Modal.getInstance(modalElement);
            modalInstance.hide();
            
            renderAssets(); // Refresh table
            deleteIndex = null;
        }
    });

    // --- ADD ASSET LOGIC ---
    assetForm.addEventListener('submit', (e) => {
    e.preventDefault();

    let imageInput = document.getElementById("imageInput");
    let file = imageInput.files[0];

    let reader = new FileReader();

    reader.onload = function () {
        const newAsset = {
            type: document.getElementById('assetType').value,
            category: document.getElementById('assetCategory').value,
            karat: document.getElementById('assetKarat').value,
            weight: document.getElementById('assetWeight').value,
            price: document.getElementById('assetPrice').value,
            date: document.getElementById('assetDate').value,
            image: reader.result // ✅ الصورة
        };

        myAssets.push(newAsset);
        localStorage.setItem('userGoldAssets', JSON.stringify(myAssets));

        const modalInstance = bootstrap.Modal.getInstance(document.getElementById('addAssetModal'));
        modalInstance.hide();
        assetForm.reset();
        renderAssets();
    };

    if (file) {
        reader.readAsDataURL(file);
    } else {
        alert("اختار صورة 😅");
    }
});

    window.addEventListener('storage', (e) => {
        if (e.key === 'currentPrice') renderAssets();
    });

    renderAssets();
    setInterval(renderAssets, 5000); 
});




function compressImage(file, callback) {
    let reader = new FileReader();

    reader.onload = function (event) {
        let img = new Image();
        img.src = event.target.result;

        img.onload = function () {
            let canvas = document.createElement("canvas");
            let ctx = canvas.getContext("2d");

            let maxWidth = 300; // 👈 حجم مناسب
            let scale = maxWidth / img.width;

            canvas.width = maxWidth;
            canvas.height = img.height * scale;

            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            let compressedBase64 = canvas.toDataURL("image/jpeg", 0.6); // 👈 ضغط
            callback(compressedBase64);
        };
    };

    reader.readAsDataURL(file);
}