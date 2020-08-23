let extensionIndexURL = "https://api.github.com/repos/microBlock-IDE/microBlock-extension-index/contents/main.json";
let extensionIndex = null;

let updateExtensionIndex = async () => {
    let extensionIndexFromAPI = await fetch(extensionIndexURL, { 
        redirect: "follow",
        headers: { 
            "Accept": "application/vnd.github.v3.raw" 
        },
    });
    if (!extensionIndexFromAPI.ok) {
        NotifyE("Load extension index fail");
        return false;
    }
    extensionIndexFromAPI = await extensionIndexFromAPI.json();
    extensionIndex = extensionIndexFromAPI;

    return true;
}

let installExtension = async (extensionId) => {
    if (typeof extensionIndex[extensionId] === "undefined") {
        NotifyE("Not found " + extensionId + " in extension index");
        return false;
    }
    let extension = extensionIndex[extensionId];
    let extensionLocalPath = `/extension/${extensionId}`;
    
    let downloadRepo = await downloadRepoFromGitHubStoreInFS(extension.github, extensionLocalPath, msg => NotifyE(msg));
    if (!downloadRepo) {
        NotifyE("Download " + extension.name + " fail");
        return false;
    }

    let blocksFile = fs.walk(`${extensionLocalPath}/blocks`);
    for (const file of blocksFile) {
        if (file.endsWith(".js")) {
            let jsContent = fs.read(`${extensionLocalPath}/blocks/${file}`);
            try {
                eval(jsContent);
            } catch (e) {
                NotifyE("Script run error: " + e.toString());
                console.error(e);
            }
        } else {
            console.warn("Why file " + file + " in blocks ? support .js only so skip it");
        }
    }

    updateBlockCategory();

    NotifyS(`Install ${extension.name} extension successful`);
    saveCodeToLocal();

    return true;
}

let removeExtension = async (extensionId) => {
    fs.remove(`/extension/${extensionId}`);

    updateBlockCategory();

    NotifyS(`Uninstall ${extensionId} successful`);
    saveCodeToLocal();

    return true;
}

$("#open-extension-dialog").click(async () => {
    $("#extension-dialog .extension-list").html('');

    ShowDialog($("#extension-dialog"));

    Notiflix.Block.Standard("#extension-dialog > section", 'Loading...');

    if (!extensionIndex) {
        if (!(await updateExtensionIndex())) {
            Notiflix.Block.Remove("#extension-dialog > section");
            return;
        }
    }
    
    let extensionInstalledList = fs.ls("/extension");
    for (const [id, info] of Object.entries(extensionIndex)) {
        $("#extension-dialog .extension-list").append(`
        <li>
            <div class="extension-box${extensionInstalledList.indexOf(id) >= 0 ? " installed" : ""}" data-extension-id="${id}">
                <div class="header">
                    <div class="cover">
                        <img src="${info.github}/raw/master/${info.icon}" alt="${info.name}">
                    </div>
                    <div class="detail">
                        <div class="name">${info.name}<span class="installed-icon"><i class="fas fa-check-circle"></i></span></div>
                        <div class="author">${info.author}</div>
                        <div class="other">
                            <span class="version">${info.version}</span>
                            <a href="${info.github}" target="_blank"><i class="fab fa-github"></i></a>
                        </div>
                    </div>
                </div>
                <div class="description">${info.description}</div>
                <div class="button">
                    <button class="extension-install"><i class="fas fa-download"></i> Install</button>
                    <button class="extension-uninstall"><i class="fas fa-trash-alt"></i> Uninstall</button>
                </div>
            </div>
        </li>
        `);
    }

    Notiflix.Block.Remove("#extension-dialog > section");

    $(".extension-install").click(async function() {
        let extensionId = $(this).parents(".extension-box").attr("data-extension-id");
        let queryBox = `.extension-box[data-extension-id='${extensionId}']`;
        Notiflix.Block.Standard(queryBox, 'Installing...');

        if (await installExtension(extensionId)) {
            $(queryBox).addClass("installed");
        }

        Notiflix.Block.Remove(queryBox);
    });

    $(".extension-uninstall").click(async function() {
        let extensionId = $(this).parents(".extension-box").attr("data-extension-id");
        let queryBox = `.extension-box[data-extension-id='${extensionId}']`;

        if (removeExtension(extensionId)) {
            $(queryBox).removeClass("installed");
        }
    });
});

let uploadModuleList = [];

Blockly.Python.addUploadModule = (module) => {
    uploadModuleList.push(module);
}

$("#open-extension-creator").click(() => {
    $(".add-extension-box").fadeIn();
});

$("#form-add-extension").submit(async function(e) {
    e.preventDefault();

    let gitHubURL = $("#extension-github-url").val().match(/https:\/\/github\.com\/[^\/]+\/[^\/]+/);
    if (gitHubURL == null) {
        NotifyE("GitHub url not match");
        return;
    }
    gitHubURL = gitHubURL[0];

    Notiflix.Block.Standard(".add-extension-box", 'Loading...');

    // Call to API, See microBlock Back-end: https://github.com/microBlock-IDE/microBlock-backend
    let addExtensionToIndex = await fetch("https://us-central1-ublock-c0a08.cloudfunctions.net/extension", { 
        method: "post",
        body: gitHubURL,
        redirect: "follow"
    });
    let rosAddExtension = await addExtensionToIndex.json();
    if (addExtensionToIndex.status !== 200) {
        console.log("Add extension error", rosAddExtension);
        NotifyE("Add extension error, See console to more detail");
    } else {
        NotifyS(`Add/Update ${rosAddExtension.extension.name} extension successful`);
        $("#extension-github-url").val("");
    }

    Notiflix.Block.Remove(".add-extension-box");
});

$("#form-add-extension button[type='reset']").click(() => {
    $(".add-extension-box").fadeOut();
});

// $("#open-extension-dialog").click();
