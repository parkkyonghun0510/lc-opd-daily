/**
 * Permissions for branch access
 */
export var BranchAccessPermission;
(function (BranchAccessPermission) {
    BranchAccessPermission["NONE"] = "none";
    BranchAccessPermission["VIEW"] = "view";
    BranchAccessPermission["SUBMIT"] = "submit";
    BranchAccessPermission["APPROVE"] = "approve";
    BranchAccessPermission["MANAGE"] = "manage";
    BranchAccessPermission["ADMIN"] = "admin";
})(BranchAccessPermission || (BranchAccessPermission = {}));
