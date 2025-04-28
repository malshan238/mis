 document.addEventListener("DOMContentLoaded", allEntries);

function allEntries() {
    console.log("DOMContentLoaded triggered");

    const tbody = document.querySelector("tbody");
    if (!tbody) {
        console.error("Table body (tbody) not found.");
        return;
    }

    // Load all records initially
    loadAllRecords(tbody);

    // Handle search by Staff ID - only set up once
    const searchButton = document.getElementById('searchButton');
    if (searchButton) {
        searchButton.addEventListener('click', function () {
            const staffId = document.getElementById('staffIdInput').value;
            console.log("Searching for staff ID:", staffId);
            fetch(`http://localhost:8080/api/study_leave/${staffId}`)
                .then(response => {
                    if (!response.ok) {
                        alert("Not found");
                        document.getElementById('staffIdInput').value = '';  // Clear input field on error
                        tbody.innerHTML = '';
                        loadAllRecords(tbody); // Only reload records, not event listeners
                        throw new Error('Not found'); 
                    }
                    return response.json();
                })
                .then(StudyLeave => {
                    console.log("Fetched study leave record:", StudyLeave);
                    // Clear previous rows
                    tbody.innerHTML = '';
                    tbody.appendChild(createTableRow(StudyLeave));
                    document.getElementById('staffIdInput').value = ''; // Clear input field
                })
                .catch(error => {
                    console.error('Error fetching study leave record:', error);
                });
        });
    }
}

// Separate function to load all records
function loadAllRecords(tbody) {
    fetch("http://localhost:8080/api/study_leave")
        .then(response => {
            if (!response.ok) {
                throw new Error("Failed to fetch study leave data");
            }
            return response.json();
        })
        .then(data => {
            if (!Array.isArray(data)) {
                console.error("Expected an array but got:", data);
                return;
            }
            console.log(data);
            // Create and append rows asynchronously
            const promises = data.map(StudyLeave => createTableRow(StudyLeave));
            Promise.all(promises)
                .then(rows => {
                    rows.forEach(row => {
                        if (row) {
                            tbody.appendChild(row);
                        }
                    });
                })
                .catch(error => {
                    console.error("Error appending rows:", error);
                });
        })
        .catch(error => {
            console.error("Error fetching study leave data:", error);
        });
}




function fetchFilteredData() {
    const tbody = document.getElementById("tbody"); // Ensure tbody is defined
    tbody.innerHTML = ''; // Clear existing table rows
    const statusFilter = document.getElementById("statusFilter").value;

    // Prepare the API URL based on the selected status
    let apiUrl = 'http://localhost:8080/api/study_leave/'; // Base URL
    // Check if a valid status is selected
    if (statusFilter == "current-month-year") {
        // Append the selected filter to the API URL
        apiUrl += statusFilter;}
    else if(statusFilter=="current-month-year-past"){
        apiUrl+=statusFilter;
    }
    else {
        tbody.innerHTML = '';
        allEntries();
    }
    console.log(apiUrl);
    fetch(apiUrl)
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok ' + response.statusText);
            }
            return response.json();
        })
        .then(data => {
            data.forEach(StudyLeaveDTO => {
                const row = createTableRow(StudyLeaveDTO);
                if (!(row instanceof Node)) {
                    console.error("Invalid row created:", row);
                    return; // Skip appending this invalid row
                }
                tbody.appendChild(row);
            });
        })
        .catch(error => {
            console.error('Error fetching data:', error);
        });
}


function createTableRow(StudyLeave, status_1 = "pending", status_2 = "pending", status_3 = "pending") {
    console.log("Creating table row for:", StudyLeave);

    const row = document.createElement("tr");
    row.innerHTML = `
        <td>${StudyLeave.leaveId}</td>
        <td>${StudyLeave.startDate}</td>
        <td>${StudyLeave.endDate}</td>
        <td>${StudyLeave.staffMember?.staffId || "N/A"}</td>
        <td>${StudyLeave.staffMember?.name || "N/A"}</td>
        <td>${StudyLeave.staffMember?.faculty?.facultyName || "N/A"}</td>
        <td>${StudyLeave.staffMember?.department?.departmentName || "N/A"}</td>
        <td><button type="button" class="more-info-btn" data-id="${StudyLeave.staffMember?.staffId}">More Info</button></td>
        <td>${StudyLeave.step1 || status_1}</td>
        <td>${StudyLeave.step2 || status_2}</td>
        <td>${StudyLeave.step3 || status_3}</td>
        <td>${StudyLeave.step4 || "pending"}</td>
    `;

    const moreInfoBtn = row.querySelector(".more-info-btn");
    moreInfoBtn.addEventListener("click", function () {
        const staffId = this.getAttribute("data-id");
        console.log("Redirecting to student info page for student with ID:", staffId);
        window.location.href = `../templates/study-leave-info.html?staffId=${encodeURIComponent(staffId)}`;
    });

    return row;
}


window.onload = function () {
    const urlParams = new URLSearchParams(window.location.search);
    console.log("Full URL:", window.location.href);
    const staffId = urlParams.get('staffId');
    console.log("Extracted staffId:", staffId);

    if (staffId) {
        // These functions are assumed to be defined elsewhere
        fetchEmployeeDetails(staffId);
        fetchAdditionalInfo(staffId);

        // Fetch the initial state of steps and update button appearances
        fetchApprovedSteps(staffId);

        // Add event listeners to approve buttons
        const buttons = document.querySelectorAll(".approve-step-button");
        buttons.forEach(button => {
            button.addEventListener("click", () => {
                const stepName = button.getAttribute("data-step-name");
                // Call the corrected approveStep function
                approveStep(staffId, stepName, button);
                // Removed redundant fetchApprovedSteps(staffId) call here
            });
        });
    } else {
        console.error("Staff ID not found in URL parameters.");
        // Optionally display an error message to the user on the page
    }
};

/**
 * Approves a specific step for a given staff member.
 * Fetches the current state, updates the specific step, and PUTs the full state back.
 * @param {string} staffId - The ID of the staff member.
 * @param {string} stepName - The name of the step to approve (e.g., "Step 1").
 * @param {HTMLButtonElement} button - The button element that was clicked.
 */
async function approveStep(staffId, stepName, button) {
    // Indicate processing (optional)
    button.disabled = true;
    button.textContent = 'Processing...';

    try {
        // 1. Fetch the current state of ALL steps first
        const getStepsResponse = await fetch(`http://localhost:8080/api/study_leave/${encodeURIComponent(staffId)}`);

        if (!getStepsResponse.ok) {
            // Handle HTTP errors during fetch
            throw new Error(`Failed to fetch current steps. Status: ${getStepsResponse.status}`);
        }

        const currentStepsData = await getStepsResponse.json();
        console.log("Fetched current steps before update:", currentStepsData);

        // 2. Create the payload based on the current state
        //    Ensure payload includes all expected fields for the PUT request
        //    Assuming the GET response structure matches the expected PUT body structure
        const payload = { ...currentStepsData };

        // 3. Modify the specific step being approved
        if (stepName === "Step 1") payload.step1 = "Approved";
        else if (stepName === "Step 2") payload.step2 = "Approved";
        else if (stepName === "Step 3") payload.step3 = "Approved";
        else if (stepName === "Step 4") payload.step4 = "Approved";
        // Add more steps here if needed

        console.log("Payload to send for PUT:", payload);

        // 4. Send the PUT request with the updated payload
        const updateResponse = await fetch(`http://localhost:8080/api/study_leave/${encodeURIComponent(staffId)}/steps`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload) // Send the modified full object
        });

        // 5. Handle the PUT response
        if (updateResponse.ok) {
            console.log(`${stepName} approved successfully.`);
            // Update UI permanently on success
            button.textContent = `${stepName} Approved`;
            // Button remains disabled
        } else {
            // Handle HTTP errors during update
            console.error(`Failed to approve ${stepName}. Status: ${updateResponse.status}`);
            // Re-enable button on failure so user can retry (optional)
            button.disabled = false;
            button.textContent = `Approve ${stepName}`; // Reset text
            // Optionally show an error message to the user
            alert(`Failed to approve ${stepName}. Server responded with status ${updateResponse.status}.`);
        }

    } catch (err) {
        // Handle network errors or errors during JSON parsing or other issues
        console.error(`Error during ${stepName} approval process:`, err);
        // Re-enable button on failure
        button.disabled = false;
        button.textContent = `Approve ${stepName}`; // Reset text
         // Optionally show an error message to the user
         alert(`An error occurred while approving ${stepName}. Please check the console or try again later.`);
    }
}

/**
 * Fetches the current approval status for all steps and updates the UI.
 * @param {string} staffId - The ID of the staff member.
 */
function fetchApprovedSteps(staffId) {
    fetch(`http://localhost:8080/api/study_leave/${encodeURIComponent(staffId)}`)
        .then(res => {
            if (!res.ok) {
                 // Handle HTTP errors (e.g., 404 Not Found if staffId is invalid)
                console.error(`Failed to fetch steps initial state. Status: ${res.status}`);
                 // Throw an error to be caught by .catch()
                throw new Error(`HTTP error! status: ${res.status}`);
            }
            return res.json(); // Parse JSON only if response is OK
        })
        .then(data => {
            console.log("Fetched initial steps data:", data);
            // Disable buttons based on fetched status
            if (data.step1 === "Approved") disableButton("Step 1");
            if (data.step2 === "Approved") disableButton("Step 2");
            if (data.step3 === "Approved") disableButton("Step 3");
            if (data.step4 === "Approved") disableButton("Step 4");
            // Add more steps here if needed
        })
        .catch(err => {
            // Catches errors from fetch() itself (network issues) or from the .then() chain
            console.error("Failed to fetch or process initial steps:", err);
            // Optionally display an error to the user that initial state couldn't be loaded
        });
}

/**
 * Disables a button and updates its text to show it's approved.
 * @param {string} stepName - The step name corresponding to the button's data-step-name attribute.
 */
function disableButton(stepName) {
    const btn = document.querySelector(`.approve-step-button[data-step-name="${stepName}"]`);
    if (btn) {
        btn.disabled = true;
        btn.textContent = `${stepName} Approved`;
    } else {
        // Log a warning if a button isn't found - might indicate a mismatch
        // between fetched data and HTML structure.
        console.warn(`Button for step "${stepName}" not found during initial UI update.`);
    }
}

// Dummy functions if they weren't provided, to avoid errors if called
// function fetchEmployeeDetails(staffId) { console.log(`Workspaceing employee details for ${staffId}`)}
// function fetchAdditionalInfo(staffId) { console.log(`Workspaceing additional info for ${staffId}`)}
// Function to populate the fields with employee data
function populateEmployeeDetails(employee) {
    document.getElementById('general-name').textContent = employee.name ;
    document.getElementById('user-id').textContent = employee.staffId ;
    document.getElementById('user-designation').textContent = employee.positionTitle ;
    document.getElementById('user-department').textContent = employee.department ;
    document.getElementById('user-faculty').textContent = employee.faculty ;
    document.getElementById('user-date-of-appointment').textContent = employee.appointmentDate ;
    document.getElementById('user-years-of-service').textContent = employee.yearsOfService ;
    document.getElementById('user-age').textContent = employee.age;
    document.getElementById('email-id').textContent = employee.email ;


}

function populateAdditionalInfo(studyLeave){
    document.getElementById('titleOfTraining').textContent = studyLeave.titleOfTrainingOrOther ;
    document.getElementById('donorAgency').textContent = studyLeave.donorAgency ;
    document.getElementById('sourceOfFunds').textContent = studyLeave.sourceOfFunds ;
    document.getElementById('nameOfProject').textContent = studyLeave. nameOfTheProject ;
    document.getElementById('countryAndCity').textContent = studyLeave.countryAndCityOfTraining ;
    document.getElementById('field').textContent = studyLeave.fieldOfStudy ;
    document.getElementById('procedure').textContent = studyLeave.procedureDetails ;
    document.getElementById('startDate').textContent = studyLeave.startDate ;
    document.getElementById('endDate').textContent = studyLeave.endDate ;


}

// Function to fetch employee data from the API
function fetchEmployeeDetails(employeeId) {
    fetch(`http://localhost:8080/api/staffMember/${employeeId}`)
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            console.log("employee details okay")
            return response.json();

        })
        .then(data => {
            populateEmployeeDetails(data);
            console.log(data);
            console.log("Data popuated")
        });
        
}




function openTab(tabName) {
    // Get all elements with class="tab-content" and hide them
    const tabContents = document.getElementsByClassName("tab-content");
    for (let i = 0; i < tabContents.length; i++) {
        tabContents[i].style.display = "none"; // Hide all tab contents
    }

    // Get all elements with class="tab-btn" and remove the class "active"
    const tabButtons = document.getElementsByClassName("tab-btn");
    for (let i = 0; i < tabButtons.length; i++) {
        tabButtons[i].classList.remove("active"); // Remove "active" from all buttons
    }

    // Show the specific tab content and add "active" class to the clicked button
    document.getElementById(tabName).style.display = "block"; // Show the selected tab content
    event.currentTarget.classList.add("active"); // Add "active" class to the clicked button
}




function fetchAdditionalInfo(employeeId) {
    fetch(`http://localhost:8080/api/study_leave/${employeeId}`)
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            console.log("Additioal info are okay")
            return response.json();

        })
        .then(data => {
            populateAdditionalInfo(data);
            console.log("Data popuated")
        })
        .catch(error => {
            console.error('Error fetching studyleave data:',error);
            // document.getElementById('general-name').textContent = "Error loading employee data.";
        });
}


// Toggle the extra information panel and hide all steps except the first on page load
function toggleHiddenPanel() {
    const panel = document.getElementById('extra-info-panel');
    const toggleButton = document.querySelector('.toggle-btn');

    if (panel.style.display === 'none') {
        panel.style.display = 'block';
        toggleButton.textContent = 'Hide More Details';

        // Hide all steps except the first one on page load
        // document.addEventListener('DOMContentLoaded', () => {
            const steps = document.querySelectorAll('.step');
            steps.forEach((step, index) => {
                if (index !== 0) {
                    step.style.display = 'none'; // Hide all steps except the first one
                }
            });
        // });

    } else {
        panel.style.display = 'none';
        toggleButton.textContent = 'Show More Details';
    }
}

document.getElementById("sendEmailButton").addEventListener("click", function () {
    const id = document.getElementById('user-id').textContent;
    const emailFromDatabase = document.getElementById('email-id').textContent;
    const stepNumber = 1; // Or dynamic based on context

    if (!id || !emailFromDatabase) {
        console.log("Missing user ID or email.");
        return;
    }

    // Set message in modal and show it
    document.getElementById("confirm-message").textContent = `Are you sure you want to send the email for Step ${stepNumber}?`;
    document.getElementById("confirm-modal").style.display = "flex";

    // YES
    document.getElementById("confirm-yes").onclick = function () {
        document.getElementById("confirm-modal").style.display = "none";
        document.getElementById("loading-overlay").style.display = "flex";

        const subject = "Subject Title";
        const heading = `${stepNumber}`;

        fetch(`http://localhost:8080/api/email`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                toEmail: emailFromDatabase,
                subject: subject,
                body: heading,
            }),
        }).then(response => {
            document.getElementById("loading-overlay").style.display = "none";
            alert(response.ok ? "Email sent successfully!" : "Failed to send email.");
        }).catch(error => {
            document.getElementById("loading-overlay").style.display = "none";
            alert("An error occurred while sending the email.");
            console.error(error);
        });
    };

    // NO
    document.getElementById("confirm-no").onclick = function () {
        document.getElementById("confirm-modal").style.display = "none";
    };
});



    function completeStep(stepNumber) {
        fetch(`http://localhost:8080/api/steps/${stepNumber}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            }
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to update step');
            }
            return response.json();
        })
        .then(data => {
            console.log(`Step ${stepNumber} completed`, data);

            // Mark the current step as completed
            document.getElementById(`step${stepNumber}`).classList.add("completed");

            // Enable the next step's button
            const nextStepNumber = stepNumber + 1;
            const nextStep = document.getElementById(`step${nextStepNumber}`);
            if (nextStep) {
                const nextButton = nextStep.querySelector(".next-btn");
                nextButton.disabled = false;
            }
        })
        .catch(error => {
            console.error('Error completing step:', error);
        });
    }

    function sendEmail(stepNumber) {
        console.log(`Sending email for Step ${stepNumber}`);
        // Implement the email sending functionality
        // You can use the backend to send an email
    }


