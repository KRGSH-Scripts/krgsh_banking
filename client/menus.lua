RegisterNetEvent("krgsh_banking:client:accountManagmentMenu", function()
    lib.registerContext({
        id = 'renewed_banking_account_management',
        title = locale("bank_name"),
        position = 'top-right',
        options = {
            {
                title = locale("create_account"),
                icon = 'file-invoice-dollar',
                metadata = {locale("create_account_txt")},
                event = "krgsh_banking:client:createAccountMenu"
            },
            {
                title = locale("manage_account"),
                icon = 'users-gear',
                metadata = {locale("manage_account_txt")},
                event = 'krgsh_banking:client:viewAccountsMenu'
            }
        }
    })
    lib.showContext("renewed_banking_account_management")
end)

RegisterNetEvent("krgsh_banking:client:createAccountMenu", function()
    local input = lib.inputDialog(locale("bank_name"), {{
        type = "input",
        label = locale("create_account_name_label"),
        placeholder = locale("create_account_name_placeholder")
    }})
    if input and input[1] then
        local result = lib.callback.await('krgsh_banking:server:createSharedAccount', false, { displayName = input[1] })
        if result then
            lib.notify({ title = locale("bank_name"), description = locale("create_account_success"), type = "success" })
        end
    end
end)

RegisterNetEvent("krgsh_banking:client:accountsMenu", function(data)
    local menuOpts = {}
    if #data >= 1 then
        for k=1, #data do
            menuOpts[#menuOpts+1] = {
                title = data[k],
                icon = 'users-gear',
                metadata = {locale("view_members")},
                event = "krgsh_banking:client:accountsMenuView",
                args = {
                    account = data[k],
                }
            }
        end
    else
        menuOpts[#menuOpts+1] = {
            title = locale("no_account"),
            metadata = {locale("no_account_txt")},
        }
    end
    lib.registerContext({
        id = 'renewed_banking_account_list',
        title = locale("bank_name"),
        position = 'top-right',
        menu = "renewed_banking_account_management",
        options = menuOpts
    })
    lib.showContext("renewed_banking_account_list")
end)

RegisterNetEvent("krgsh_banking:client:accountsMenuView", function(data)
    lib.registerContext({
        id = 'renewed_banking_account_view',
        title = locale("bank_name"),
        position = 'top-right',
        menu = "renewed_banking_account_list",
        options = {
            {
                title = locale("manage_members"),
                icon = 'users-gear',
                metadata = {locale("manage_members_txt")},
                serverEvent = "krgsh_banking:server:viewMemberManagement",
                args = data
            },
            {
                title = locale("edit_acc_name"),
                icon = 'users-gear',
                metadata = {locale("edit_acc_name_txt")},
                event = "krgsh_banking:client:changeAccountName",
                args = data
            },
            {
                title = locale("bank_issue_card"),
                icon = 'credit-card',
                metadata = {locale("bank_issue_card_txt")},
                event = "krgsh_banking:client:issueBankCard",
                args = data
            },
            {
                title = locale("delete_account"),
                icon = 'users-gear',
                metadata = {locale("delete_account_txt")},
                serverEvent = "krgsh_banking:server:deleteAccount",
                args = data
            }
        }
    })
    lib.showContext("renewed_banking_account_view")
end)

RegisterNetEvent("krgsh_banking:client:viewMemberManagement", function(data)
    local menuOpts = {}
    local account = data.account
    for k,v in pairs(data.members) do
        menuOpts[#menuOpts+1] = {
            title = v,
            metadata = {locale("remove_member_txt")},
            event = 'krgsh_banking:client:removeMemberConfirmation',
            args = {
                account = account,
                cid = k,
            }
        }
    end
    menuOpts[#menuOpts+1] = {
        title = locale("add_member"),
        metadata = {locale("add_member_txt")},
        event = 'krgsh_banking:client:addAccountMember',
        args = {
            account = account
        }
    }
    lib.registerContext({
        id = 'renewed_banking_member_manage',
        title = locale("bank_name"),
        position = 'top-right',
        menu = 'renewed_banking_account_view',
        options = menuOpts
    })
    lib.showContext("renewed_banking_member_manage")
end)

RegisterNetEvent('krgsh_banking:client:removeMemberConfirmation', function(data)
    lib.registerContext({
        id = 'renewed_banking_member_remove',
        title = locale('bank_name'),
        position = 'top-right',
        menu = 'renewed_banking_account_view',
        options = {
            {
                title = locale('remove_member'),
                metadata = {locale('remove_member_txt2', data.cid)},
                serverEvent = 'krgsh_banking:server:removeAccountMember',
                args = data
            }
        }
    })
    lib.showContext('renewed_banking_member_remove')
end)

RegisterNetEvent('krgsh_banking:client:addAccountMember', function(data)
    local input = lib.inputDialog(locale('add_account_member'), {{
        type = 'input',
        label = locale('citizen_id'),
        placeholder = '1001'
    }})
    if input and input[1] then
        input[1] = input[1]:upper():gsub("%s+", "")
        TriggerServerEvent('krgsh_banking:server:addAccountMember', data.account, input[1])
    end
end)

RegisterNetEvent('krgsh_banking:client:issueBankCard', function(data)
    local input = lib.inputDialog(locale('bank_issue_card'), {
        {
            type = 'number',
            label = locale('bank_card_target_server_id'),
            description = locale('bank_card_target_server_id_desc'),
            default = GetPlayerServerId(PlayerId()),
            min = 1,
        },
        {
            type = 'input',
            label = locale('bank_card_pin_optional'),
            password = true,
        },
    })
    if not input then return end
    local targetId = tonumber(input[1]) or GetPlayerServerId(PlayerId())
    local pinRaw = input[2]
    local pin = (type(pinRaw) == 'string' and pinRaw ~= '') and pinRaw or nil
    lib.callback.await('krgsh_banking:server:issueBankCard', false, {
        accountId = data.account,
        targetServerId = targetId,
        pin = pin,
    })
end)

RegisterNetEvent('krgsh_banking:client:changeAccountName', function(data)
    local input = lib.inputDialog(locale('change_account_name'), {{
        type = 'input',
        label = locale('change_account_display_name'),
        placeholder = locale('create_account_name_placeholder')
    }})
    if input and input[1] then
        TriggerServerEvent('krgsh_banking:server:changeAccountName', data.account, input[1])
    end
end)