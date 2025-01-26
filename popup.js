document.addEventListener("DOMContentLoaded", () => {
  const startButton = document.getElementById("startCrawl");
  const statusDiv = document.getElementById("status");
  const pageLimitInput = document.getElementById("pageLimit");

  const queryInput = document.getElementById("queryInput"); // Input for RAG
  const queryButton = document.getElementById("queryButton"); // Button to trigger RAG
  const queryResultDiv = document.getElementById("queryResult"); // Result display
  const responseBox = document.getElementById("responseBox"); // Full JSON response

  // -----------------------------------------------
  // 📌 Start Web Crawling
  // -----------------------------------------------
  startButton.addEventListener("click", async () => {
    try {
      startButton.disabled = true;
      statusDiv.style.display = "block";
      statusDiv.className = "status progress";
      statusDiv.textContent = "Starting research...";

      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      const pageLimit = parseInt(pageLimitInput.value, 10) || 1;

      const response = await fetch("http://{YOUR_EC2_IP}/api/crawl", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: tab.url,
          limit: pageLimit,
        }),
      });

      const data = await response.json();

      if (data.job_id) {
        chrome.storage.local.set({ currentJobId: data.job_id });
        checkStatus(data.job_id);
      }
    } catch (error) {
      statusDiv.className = "status error";
      statusDiv.textContent = "Error: " + error.message;
      startButton.disabled = false;
    }
  });

  // -----------------------------------------------
  // 📌 Check Crawling Status
  // -----------------------------------------------
  async function checkStatus(jobId) {
    try {
      const response = await fetch(`http://{YOUR_EC2_IP}/api/status/${jobId}`);
      const data = await response.json();

      statusDiv.className = "status progress";
      statusDiv.textContent = `Progress: ${data.progress} pages processed`;

      if (data.status === "completed") {
        downloadResults(jobId);
      } else if (data.status === "failed") {
        throw new Error("Research failed");
      } else {
        setTimeout(() => checkStatus(jobId), 2000);
      }
    } catch (error) {
      statusDiv.className = "status error";
      statusDiv.textContent = "Error: " + error.message;
      startButton.disabled = false;
    }
  }

  // -----------------------------------------------
  // 📌 Download Research Results
  // -----------------------------------------------
  async function downloadResults(jobId) {
    try {
      const response = await fetch(`http://{YOUR_EC2_IP}/api/download/${jobId}`);
      const blob = await response.blob();

      const url = window.URL.createObjectURL(blob);
      chrome.downloads.download({
        url: url,
        filename: "research_results.zip",
      });

      statusDiv.className = "status success";
      statusDiv.textContent = "Research completed! Downloading results...";
      startButton.disabled = false;
    } catch (error) {
      statusDiv.className = "status error";
      statusDiv.textContent = "Error downloading results: " + error.message;
      startButton.disabled = false;
    }
  }

  // -----------------------------------------------
  // 📌 RAG (Retrieval Augmented Generation) Query
  // -----------------------------------------------
  queryButton.addEventListener("click", async () => {
    const query = queryInput.value.trim();
    if (!query) {
      queryResultDiv.className = "status error";
      queryResultDiv.textContent = "Please enter a query.";
      return;
    }

    try {
      queryButton.disabled = true;
      queryResultDiv.className = "status progress";
      queryResultDiv.textContent = "Fetching answer...";
      responseBox.style.display = "none"; // Hide response box initially

      const response = await fetch("http://{YOUR_EC2_IP}/api/rag", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query }),
      });

      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }

      // Format JSON response for better readability
      const formattedResponse = JSON.stringify(data, null, 2);

      // Show response and fill it
      responseBox.style.display = "block";
      responseBox.value = formattedResponse;

      // Auto-expand the textarea based on content
      responseBox.style.height = "auto";
      responseBox.style.height = responseBox.scrollHeight + "px";

      queryResultDiv.className = "status success";
      queryResultDiv.innerHTML = `<strong>Answer:</strong> ${data.answer} <br><br>
                                  <strong>Context:</strong> ${data.context.join("<br>")}`;
    } catch (error) {
      queryResultDiv.className = "status error";
      queryResultDiv.textContent = "Error: " + error.message;
    } finally {
      queryButton.disabled = false;
    }
  });
});
