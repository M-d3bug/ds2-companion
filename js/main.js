(function($) {

    var defaultProfiles = {
        'current': 'Default Profile'
    };
    defaultProfiles[profilesKey] = {
        'Default Profile': {
            checklistData: {}
        }
    }
    var profiles = (window.DS2Store
        ? window.DS2Store.getProfiles(profilesKey)
        : $.jStorage.get(profilesKey, defaultProfiles));

    function saveProfiles() {
        if (window.DS2Store) window.DS2Store.setProfiles(profilesKey, profiles);
        else $.jStorage.set(profilesKey, profiles);
    }

    // Host API for backup export / restore (see js/backup.js).
    window.DS2BackupHost = {
        getProfiles: function () { return profiles; },
        applyProfiles: function (next) {
            profiles = next;
            saveProfiles();
            populateProfiles();
            populateChecklists();
        }
    };

    jQuery(document).ready(function($) {

        // TODO Find a better way to do this in one pass
        $('ul li[data-id]').each(function() {
            addCheckbox(this);
        });

        tagKeyItems();
        indexSections();
        ensureProgressBars();
        bindFilterControls();
        bindToolbarVisibility();
        restoreUiState();

        populateProfiles();

        $('input[type="checkbox"]').click(function() {
            var id = $(this).attr('id');
            var isChecked = profiles[profilesKey][profiles.current].checklistData[id] = $(this).prop('checked');
            //_gaq.push(['_trackEvent', 'Checkbox', (isChecked ? 'Check' : 'Uncheck'), id]);
            if(isChecked === true) {
                $('[data-id="'+id+'"] label').addClass('completed')
            } else {
                $('[data-id="'+id+'"] label').removeClass('completed');
            }
            $(this).parent().parent().find('li > label > input[type="checkbox"]').each(function() {
                var id = $(this).attr('id');
                profiles[profilesKey][profiles.current].checklistData[id] = isChecked;
                $(this).prop('checked', isChecked);
            });
            saveProfiles();
            calculateTotals();
        });

        $('#profiles').change(function(event) {
            profiles.current = $(this).val();
            saveProfiles();
            populateChecklists();
            //_gaq.push(['_trackEvent', 'Profile', 'Change', profiles.current]);
        });

        $('#profileAdd').click(function() {
            $('#profileModalTitle').html('Add Profile');
            $('#profileModalName').val('');
            $('#profileModalAdd').show();
            $('#profileModalUpdate').hide();
            $('#profileModalDelete').hide();
            $('#profileModal').modal('show');
            //_gaq.push(['_trackEvent', 'Profile', 'Add']);
        });

        $('#profileEdit').click(function() {
            $('#profileModalTitle').html('Edit Profile');
            $('#profileModalName').val(profiles.current);
            $('#profileModalAdd').hide();
            $('#profileModalUpdate').show();
            if (canDelete()) {
                $('#profileModalDelete').show();
            } else {
                $('#profileModalDelete').hide();
            }
            $('#profileModal').modal('show');
            //_gaq.push(['_trackEvent', 'Profile', 'Edit', profiles.current]);
        });

        $('#profileModalAdd').click(function(event) {
            event.preventDefault();
            var profile = $.trim($('#profileModalName').val());
            if (profile.length > 0) {
                if (typeof profiles[profilesKey][profile] == 'undefined') {
                    profiles[profilesKey][profile] = { checklistData: {} };
                }
                profiles.current = profile;
                saveProfiles();
                populateProfiles();
                populateChecklists();
            }
            //_gaq.push(['_trackEvent', 'Profile', 'Create', profile]);
        });

        $('#profileModalUpdate').click(function(event) {
            event.preventDefault();
            var newName = $.trim($('#profileModalName').val());
            if (newName.length > 0 && newName != profiles.current) {
                profiles[profilesKey][newName] = profiles[profilesKey][profiles.current];
                delete profiles[profilesKey][profiles.current];
                profiles.current = newName;
                saveProfiles();
                populateProfiles();
            }
            $('#profileModal').modal('hide');
            //_gaq.push(['_trackEvent', 'Profile', 'Update', profile]);
        });

        $('#profileModalDelete').click(function(event) {
            event.preventDefault();
            if (!canDelete()) {
                return;
            }
            if (!confirm('Are you sure?')) {
                return;
            }
            delete profiles[profilesKey][profiles.current];
            profiles.current = getFirstProfile();
            saveProfiles();
            populateProfiles();
            populateChecklists();
            $('#profileModal').modal('hide');
            //_gaq.push(['_trackEvent', 'Profile', 'Delete']);
        });

        $("#toggleHideCompleted").change(function() {
            var hidden = !$(this).is(':checked');

            

            $('body').toggleClass('hide_completed', !hidden);

            saveUiState({ hideCompleted: !hidden });
            applyFilters();
        });

        $('#toggleCollapseAll').change(function () {

            // the reader just took over every section, so stop tracking ours
            autoExpanded = [];

            
            if ($(this).data("lastState") === null || $(this).data("lastState") === 0) {

                    // close all
                    $('.collapse').collapse('show');

                    // next state will be open all
                    $(this).data("lastState",1);

                }
                
            else {
                

                // initial state...
                // override accordion behavior and open all
                $('.panel-collapse.in').removeData('bs.collapse.in')
                .collapse({parent:true, toggle:false})
                .collapse('hide')
                .removeData('bs.collapse.in')
                // restore single panel behavior
                .collapse({parent:'#tabPlaythrough', toggle:false});

                // next state will be close all
                $(this).data("lastState",0);
            }
            var hidden = !$(this).is(':checked');
            $('body').toggleClass('collapse_all', !hidden);

        });

        $('[data-item-toggle]').change(function() {
            var type = $(this).data('item-toggle');
            var to_hide = $(this).is(':checked');

            calculateTotals();
        });

        calculateTotals();

    });

    function populateProfiles() {
        $('#profiles').empty();
        $.each(profiles[profilesKey], function(index, value) {
            $('#profiles').append($("<option></option>").attr('value', index).text(index));
        });
        $('#profiles').val(profiles.current);
    }

    function populateChecklists() {
        $('input[type="checkbox"]').prop('checked', false);
        $('li[data-id] label').removeClass('completed');
        $.each(profiles[profilesKey][profiles.current].checklistData, function(index, value) {
            var box = $('#' + index);
            box.prop('checked', value);
            if (value) box.closest('label').addClass('completed');
        });
        calculateTotals();
    }

    function calculateTotals() {
        $('[id$="_overall_total"]').each(function(index) {
            var type = this.id.match(/(.*)_overall_total/)[1];
            var overallCount = 0, overallChecked = 0;
            $('[id^="' + type + '_totals_"]').each(function(index) {
                var regex = new RegExp(type + '_totals_(.*)');
                var regexFilter = new RegExp('^playthrough_(.*)');
                var i = parseInt(this.id.match(regex)[1]);
                var count = 0, checked = 0;
                for (var j = 1; ; j++) {
                    var checkbox = $('#' + type + '_' + i + '_' + j);
                    if (checkbox.length == 0) {
                        break;
                    }
                    if(checkbox.is(':hidden') && checkbox.prop('id').match(regexFilter) && canFilter(checkbox.closest('li'))) {
                        continue;
                    }
                    count++;
                    overallCount++;
                    if (checkbox.prop('checked')) {
                        checked++;
                        overallChecked++;
                    }
                }
                var $track = $(this).closest('h3').next('.section-progress-track');
                if ($track.length) {
                    var percent = count > 0 ? Math.round((checked / count) * 100) : 0;
                    $track.children('.section-progress-bar')
                        .css('width', percent + '%')
                        .toggleClass('done', count > 0 && checked === count);
                    $track.attr('data-progress', percent);
                }

                if (checked === count) {
                    this.innerHTML = $('#' + type + '_nav_totals_' + i)[0].innerHTML = 'DONE';
                    $(this).removeClass('in_progress').addClass('done');
                    $($('#' + type + '_nav_totals_' + i)[0]).removeClass('in_progress').addClass('done');
                } else {
                    this.innerHTML = $('#' + type + '_nav_totals_' + i)[0].innerHTML = checked + '/' + count;
                    $(this).removeClass('done').addClass('in_progress');
                    $($('#' + type + '_nav_totals_' + i)[0]).removeClass('done').addClass('in_progress');
                }
            });
            if (overallChecked === overallCount) {
                this.innerHTML = 'DONE';
                $(this).removeClass('in_progress').addClass('done');
            } else {
                this.innerHTML = overallChecked + '/' + overallCount;
                $(this).removeClass('done').addClass('in_progress');
            }
        });

        updateToolbarOverall();
    }

    function addCheckbox(el) {
        var $el = $(el);
        // assuming all content lies on the first line
        var content = $el.html().split('\n')[0];
        var sublists = $el.children('ul');

        content =
            '<div class="checkbox">' +
                '<label>' +
                    '<input type="checkbox" id="' + $el.attr('data-id') + '">' +
                    '<span class="item_content">' + content + '</span>' +
                '</label>' +
            '</div>';

        $el.html(content).append(sublists);

        if (profiles[profilesKey][profiles.current].checklistData[$el.attr('data-id')] === true) {
            $('#' + $el.attr('data-id')).prop('checked', true);
            $('label', $el).addClass('completed');
        }
    }

    function canDelete() {
        var count = 0;
        $.each(profiles[profilesKey], function(index, value) {
            count++;
        });
        return (count > 1);
    }

    function getFirstProfile() {
        for (var profile in profiles[profilesKey]) {
            return profile;
        }
    }

    function canFilter(entry) {
        if (!entry.attr('class')) {
            return false;
        }
        var classList = entry.attr('class').split(/\s+/);
        var foundMatch = 0;
        for (var i = 0; i < classList.length; i++) {
            if (!classList[i].match(/^f_(.*)/)) {
                continue;
            }
            if(classList[i] in profiles[profilesKey][profiles.current].hidden_categories) {
                if(!profiles[profilesKey][profiles.current].hidden_categories[classList[i]]) {
                    return false;
                }
                foundMatch = 1;
            }
        }
        if (foundMatch === 0) {
            return false;
        }
        return true;
    }

    /*
     * -------------------------
     * Back to top functionality
     * -------------------------
     */
    $(function() {
        var offset = 220;
        var duration = 500;
        $(window).scroll(function() {
            if ($(this).scrollTop() > offset) {
                $('.fadingbutton').fadeIn(duration);
            } else {
                $('.fadingbutton').fadeOut(duration);
            }
        });

        $('.back-to-top').click(function(event) {
            event.preventDefault();
            $('html, body').animate({scrollTop: 0}, duration);
            return false;
        });
    });

    $('#toggleHideCompleted').attr('checked', false);

    /*
     * ------------------------------------------
     * Restore tabs/hidden sections functionality
     * ------------------------------------------
     
     $(function() {
        // reset `Hide completed` button state (otherwise Chrome bugs out)
        $('#toggleHideCompleted').attr('checked', false);

        // restore collapsed state on page load
        restoreState(profiles.current);

        if (profiles[profilesKey][profiles.current].current_tab) {
            $('.nav.nav-tabs li a[href="' + profiles[profilesKey][profiles.current].current_tab + '"]').click();
        }

        // register on click handlers to store state
        $('a[href$="_col"]').on('click', function(el) {
            var collapsed_key = $(this).attr('href');
            var saved_tab_state = !!profiles[profilesKey][profiles.current].collapsed[collapsed_key];

            profiles[profilesKey][profiles.current].collapsed[$(this).attr('href')] = !saved_tab_state;

            saveProfiles();
        });

        $('.nav.nav-tabs li a').on('click', function(el) {
            profiles[profilesKey][profiles.current].current_tab = $(this).attr('href');

            saveProfiles();
        });
     });
     */

    /*
     * ------------------------------------------------------------------
     * Key item badges
     * ------------------------------------------------------------------
     * Badges are derived from each entry's own links and text, so the
     * checklist data in index.html is never touched. Nested sub-entries are
     * ignored while tagging a row, otherwise a merchant row would inherit
     * every item sold inside it.
     *
     * Evidence model - a badge is a claim about what the row is asking the
     * reader to do, so a rule only fires when one sentence of the row shows
     * both halves of the claim:
     *   anchor   - the thing itself: a link to its page, or its name in the
     *              wording
     *   evidence - that same sentence acting on the thing: used, opened,
     *              joined, killed, lit, bought, picked up
     * and the row as a whole shows neither of:
     *   exclude  - wording that proves the match is a different thing (an item
     *              named after a boss, a place named after a bonfire); vetoes
     *              the rule outright
     *
     * A rule may also set `window`, the radius in characters within which the
     * evidence must sit relative to the anchor. Without it, a long sentence
     * can supply the verb from one clause while the name appears in another.
     *
     * A rule that anchors on links may set `urlsText` - the link text has to
     * name the thing as well. A link whose href points at a page but whose
     * text says something else (a typo in the source data) must not smuggle
     * a badge in.
     *
     * Nothing is badged on a keyword, a location name or a mention in
     * passing: every rule spells out what counts as acting on its item, a
     * link alone is not enough, and anchor and evidence must share a
     * sentence so a mention in one sentence cannot borrow the verb from
     * another. A boss, for example, needs the row to kill, fight or defeat
     * that encounter - "fog gate", "boss room" and "boss armor" are not
     * encounters, a boss named in passing is not a fight, and a boss named
     * as the condition for some loot is a loot row.
     */

    // named bosses; the lookahead keeps possessives ("Dragonrider's boss
    // room", "the Pursuer's soul") from reading as an encounter
    var bossNames = /last giant|pursuers?|old dragonslayer|dragonriders?|flexile sentry|ruin sentinels?|lost sinner|belfry gargoyles?|skeleton lords?|executioner['\u2019]s chariot|covetous demon|mytha|smelter demons?|old iron king|royal rat vanguard|royal rat authority|scorpioness najka|prowling magus|(?:duke['\u2019]s )?dear freja|(?:the )?rotten|looking glass knight|demon of song|velstadt|guardian dragons?|ancient dragon|giant lord|vendrick|throne watcher|throne defender|nashandra|aldia|darklurker|elana|sinh|fume knight|sir alonne|graverobber|aava|burnt ivory king|lud (?:and|&) zallen/i;

    // a handful of these names are worn by minibosses as well, so outside the
    // area the wiki lists for the encounter the row is an ordinary enemy:
    // the Pursuer on the Things Betwixt beach or in the Iron Keep, the two
    // Flexile Sentries in Sinner's Rise and Eleum Loyce, the three loot
    // dragons of the Dragon Aerie, the frosty Covetous Demon, the Prowling
    // Magus of the Shrine of Amana.
    var minibossAreas = [
        { name: /\bpursuers?\b/i, areas: ['Things_Betwixt', 'Iron_Keep', 'The_Lost_Bastille'] },
        { name: /flexile sentry/i, areas: ['Sinners_Rise', 'Frozen_Eleum_Loyce'] },
        { name: /guardian dragons?/i, areas: ['Dragon_Aerie', 'Heides_Tower_Of_Flame'] },
        { name: /covetous demon/i, areas: ['Frozen_Eleum_Loyce'] },
        { name: /prowling magus/i, areas: ['Shrine_Of_Amana'] }
    ];

    // every named NPC and summon on the wiki's NPC page
    var npcNameList = [
        'Aldia, Scholar', 'Alsanna', 'Belfry Guard', 'Benhart', 'Lenigrast', 'Targray|Targaray', 'Cale', 'Drummond',
        'Carhillion', 'Wellager', 'Creighton', 'Cromwell', 'Grandahl', 'Emerald Herald', 'Felkin', 'Agdayne', 'Griant',
        'Vengarl', 'Milibeth', 'Gilligan', 'Licia', 'Gavlan', 'Loyce Knight', 'Lucatiel', 'Magerold', 'Manscorpion|\\bTark\\b',
        'Maughlin', 'Melentia', 'Pate', 'Milfanito', 'Morrel', 'Rosabeth', 'Navlaan', 'Saulden', 'Dyna and Tillo|Sparkling Sisters',
        'McDuff', 'Chloanne', 'Straid', 'Strowen', 'Shalquoir', 'Rat King', 'Titchy Gren', 'Vendrick', 'Ornifex', 'Feeva',
        'Ashen Knight Boyd', 'Bashful Ray', 'Bradley of the Old Guard', 'Devotee Scarlett', 'Drifter Swordsman Aidel',
        'Felicia the Brave', 'Jester Thomas', 'Lone Hunter Schmidt', 'Manhunter', 'Masterless Glencour', 'Melinda the Butcher',
        'Pilgrim Bellclaire', 'Rapacious Andrei', 'Ruined Aflis', 'Sellsword Luet', 'Steelheart Ellie', 'Steel-willed Lorrie',
        'Transcendent Edde|Transendent Edde', 'Twiggy Shei'
    ];
    var npcNames = new RegExp('\\b(?:' + npcNameList.join('|') + ')', 'i');
    // and what counts as dealing with one: their dialogue, their quest, their
    // shop, being summoned by them, or taking their gear off their corpse.
    // meets/met and shows/showed are deliberately absent: they describe what
    // the NPC does to the player or a mention in passing, not an interaction
    // the row asks the reader to perform.
    var npcDeal = /\b(?:talks?|talked|talking|speaks?|spoke|spoken|speaking|exhausts?|exhausted|exhausting|summons?|summoned|summoning|buys?|bought|buying|sells?|selling|sell|sold|trades?|traded|trading|trade|gives?|gave|given|giving|gifts?|gifted|receives?|received|receiving|finds?|found|finding|kills?|killed|killing|frees?|freed|freeing|free|rescues?|rescued|rescuing|joins?|joined|joining|pays?|paid|paying|on the nest|rank up)\b/i;
    // Vendrick and Aldia are both an NPC and a boss; the fights stay fights
    var npcNotFight = /\b(?:kill\w*|defeat\w*|slay\w*|fight\w*)\s+(?:king\s+)?(?:vendrick|aldia)\b/i;

    // the wiki's covenant list
    var covenantNames = /way of blue|company of champions|heirs of the sun|blue sentinels?|brotherhood of blood|bell keepers?|rat king covenant|pilgrims of (?:the )?dark|dragon remnants/i;

    // the wiki's key items, including the two hearts and the King's Ring
    var keyNames = /lenigrast['\u2019]s key|antiquated key|soldier key|bastille key|brightstone key|house key|tseldora den key|undead lockaway key|fang key|iron key|heavy iron key|tower key|aldia key|garrison ward key|eternal sanctum key|forgotten key|key to king['\u2019]s passage|key to the embedded|ashen mist heart|giant['\u2019]s kinship|dull ember|rotunda lockstone|dragon talon|dragon stone|frozen flower|eye of the priestess|ladder miniature|scorching iron scepter|king['\u2019]s ring/i;
    var bossOrder = '(?:first|final|last|next|other|optional|second|third|fourth|two|three|four|lone|crystal|giant|both|king|queen|lord|lady|sir|duke|princess)?\\s*';
    // a boss named as the gate to loot ("kill X for the Y") is a loot row,
    // not an encounter, so the kill has to stop there
    var bossReward = '(?![^.]{0,20}?\\b(?:to (?:get|obtain|receive)|for \\w+)\\b)';
    // a boss name followed by one of these is the boss being described, not
    // fought: "boss soul", "boss weapon", "boss fight" and "boss room" are
    // things named after the boss, not the encounter itself
    var bossNotEncounter = "(?!\\s+(?:soul|souls|weapon|weapons|armor|armour|set|sets|room|rooms|arena|arenas|gate|gates|fog|fogs|fight|fights|encounter|encounters|battle|battles|health|bar|bars)\\b)";
    var bossMention = new RegExp('\\b(?:' + bossNames.source + ")(?!['\\u2019]s\\b)", 'i');
    var bossAttack = new RegExp('\\b(?:kill|kills|killing|defeat|defeats|defeating|slay|slays|slaying|beat|beating|fight|fights|fighting|face|facing)\\b\\s+(?:the\\s+|a\\s+|an\\s+)?' + bossOrder + '(?:' + bossNames.source + ")(?!['\\u2019]s\\b)" + bossNotEncounter + bossReward, 'i');
    var bossFight = new RegExp('\\b(?:kill|kills|killing|defeat|defeats|defeating|slay|slays|slaying|beat|beating|fight|fights|fighting|face|facing)\\b\\s+(?:the\\s+|a\\s+|an\\s+)?' + bossOrder + 'boss(?:es)?\\b' + bossNotEncounter + bossReward, 'i');

    var badgeRules = [
        { key: 'boss', label: 'Boss', title: 'Boss - the major boss encounters',
          text: [/\bboss(?:es)?\b/i, bossMention],
          // the fight has to be what the row asks for: killing or fighting a
          // boss. Talking about a boss fight, a boss room or the boss showing
          // up is not an instruction to beat it, so neither counts on its own
          evidence: [bossFight, bossAttack],
          // ... and a name that a miniboss wears only counts as the encounter
          // inside the area the wiki gives for it
          block: function(sentence, section) {
              var blocked = false;
              $.each(minibossAreas, function(i, entry) {
                  if ($.inArray(section, entry.areas) >= 0 && entry.name.test(sentence)) { blocked = true; }
              });
              return blocked;
          },
          exclude: [
              // the boss is named as the condition for something else, e.g.
              // "come back when you kill the Royal Rat Vanguard" or a wedge
              // "obtained after killing the Fume Knight"
              /\b(?:when|once|after|before|until|unless|if)\s+(?:you\s+|you'?ve\s+)?(?:have\s+|had\s+|already\s+|finally\s+)?(?:kill|defeat|slay|beat|fight)\w*\b/i,
              // the boss is the price of a reward: "get for killing the boss"
              /\bfor (?:killing|defeating|slaying)\b/i
          ] },
        { key: 'bonfire', label: 'Bonfire', title: 'Bonfire - light and rest points',
          text: [/\bbonfire\b(?! ascetics?)/i],
          evidence: [
              // the verb has to act on a bonfire itself: it may not be part of
              // a place name ("Soldier's Rest"), pass by it ("use your feather
              // to get back to the bonfire", "travel to the X bonfire") or be
              // acting on something that merely sits next to one ("light the
              // sconce next to the bonfire")
              /\b(?:light|lit|relight|kindle|ignite|activate|touch|use|using|used)\b\s+(?:(?!\b(?:get|gets|go|goes|going|return\w*|travel\w*|warp\w*|feather|back|next|beside|near|behind|past|before|after|opposite|toward|towards|by)\b)[\w'&.,()\/-]+\s+){0,9}bonfire\b/i,
              /\brest(?:ing|ed|s)?\s+(?:at|by)\s+(?:the\s+|a\s+|your\s+)?bonfire\b/i,
              /\bbonfire\b[^.]{0,25}\b(?:and|then)\s+rest(?:ing)?\s+(?:at|by)\s+(?:it|the bonfire)\b/i,
              // a bonfire reached by hand: lighting it after walking up to it
              /\bbonfire\b[^.]{0,60}\b(?:light|lite|lit|relight|kindle)\s+it\b/i,
              // finding one is a step of its own, unlike passing one on the way
              /\b(?:find|finds|found|finding|access|accessing|discover\w*)\b[^.]{0,25}\bbonfire\b/i
          ] },
        { key: 'npc', label: 'NPC', title: 'NPC - dialogue, quests, merchants, summons and the gear they drop',
          // the NPC and the verb have to be in the same breath, so a name
          // dropped in one clause cannot borrow a verb from another
          window: 60,
          // these two checklists are nothing but NPC steps: where to find an
          // exile for Majula, and where Lucatiel can be summoned
          sections: ['Gathering_Of_Exiles', 'Lucatiel'],
          text: [/\btalk to\b/i, /\bspeak to\b/i, /\btalk with\b/i, /\bspeak with\b/i, /\bexhaust (?:his|her|their|the)\b/i, /\bnpcs?\b/i, npcNames],
          evidence: [
              /[Tt]alk(?:ing|s|ed)?\s+(?:to|with)\s+(?:him|her|them|the\b|[A-Z]|$)/,
              /[Ss]peak(?:ing|s)?\s+(?:to|with)\s+(?:him|her|them|the\b|[A-Z]|$)/,
              /[Ee]xhaust\s+(?:his|her|their|the)\b/,
              npcDeal
          ],
          exclude: [
              // Vendrick and Aldia are on the NPC page and in the boss list: a
              // row that fights them is an encounter, not a conversation
              npcNotFight,
              // rows that only talk about phantoms or about the absence of NPCs
              /\bno\s+npcs?\b|\bnpc phantoms?\b|\bnpcs?\s+or\b/i
          ] },
        { key: 'estus', label: 'Estus', title: 'Estus - flask shards and sublime bone dust',
          // the base Estus Flask page is not a pickup, only the shard and the
          // Sublime Bone Dust pages are: the flask page is deliberately not
          // in this list
          urls: [/\/estus-flask-shard/i, /\/sublime-bone-dust/i],
          // and the link text has to agree with the URL, so a link whose href
          // points at sublime-bone-dust but whose visible text reads something
          // else (a typo in the data) does not smuggle the badge in
          urlsText: [/\bestus flask shards?\b/i, /\bsublime bone dust\b/i],
          // same for plain text: only the shard and the bone dust name the
          // badge, the base Estus Flask is not what this badge is about
          text: [/\bestus flask shards?\b/i, /\bsublime bone dust\b/i],
          // this badge marks where a shard or a Sublime Bone Dust is picked
          // up: the container and the pickup verbs count, the reminder verbs
          // ("remember to upgrade", "burn the dust") do not, because they say
          // what to do with the item, not where it is
          evidence: [/\b(?:get|gets|got|getting|pick(?:ed)? up|grab|find|finds|found|finding|obtain\w*|collect\w*|loot\w*|take|buy|buys|bought|purchas\w*|receive\w*|reward\w*|drop\w*|chests?|corpses?)\b/i] },
        { key: 'key', label: 'Key', title: 'Key - key items and the doors they open',
          urls: [/(?:^|[-/])keys?(?:[-/]|$)/i, /\/ashen-mist-heart/i, /\/giant-s-kinship/i, /\/king-s-ring/i],
          text: [/\bkeys?\b/i, keyNames],
          evidence: [/\b(?:open|opens|opened|opening|unlock\w*|use|using|used|need(?:s|ed|ing)?|require\w*|get|gets|got|getting|pick(?:ed)? up|grab|find|found|obtain\w*|acquire\w*|receive|reward\w*|loot\w*|take|drop\w*|chests?|corpses?|carry|bring|have|has|held|insert\w*|put on|souls|cost|price|buy|buys|bought|purchas\w*|spend|pay\w*|trade)\b/i] },
        { key: 'branch', label: 'Branch', title: 'Branch - Fragrant Branch of Yore',
          urls: [/\/fragrant-branch-of-yore/i],
          // unpetrifying needs a branch, whether or not the row names it
          text: [/\bfragrant branches? of yore\b/i, /\bunpetrif\w*/i],
          evidence: [/\b(?:use|using|used|need(?:s|ed)?|require\w*|unpetrif\w*|remov\w*|open\w*|free|get|gets|got|getting|pick(?:ed)? up|grab|find|found|obtain\w*|loot\w*|take|buy|buys|bought|purchas\w*|price|cost|souls|chests?|corpses?|drop\w*|trade|give|have|has|hold|carry)\b/i] },
        { key: 'lockstone', label: 'Lockstone', title: 'Lockstone - Pharros Lockstone',
          urls: [/\/pharros-lockstone/i],
          text: [/\bpharros'?s? lockstones?\b/i],
          evidence: [/\b(?:use|using|used|need(?:s|ed)?|require\w*|open\w*|unlock\w*|light up|lower|raise|reveal\w*|get|gets|got|getting|pick(?:ed)? up|grab|find|found|obtain\w*|loot\w*|take|buy|buys|bought|purchas\w*|earn\w*|price|cost|souls|chests?|corpses?|drop\w*|have|has|contraption|mechanism)\b/i] },
        { key: 'vessel', label: 'Soul Vessel', title: 'Soul Vessel - stat reallocation',
          urls: [/\/soul-vessel/i],
          text: [/\bsoul vessels?\b/i],
          evidence: [/\b(?:use|using|used|need(?:s|ed)?|require\w*|reallocat\w*|respec|reset|redistribut\w*|level|get|gets|got|getting|pick(?:ed)? up|grab|find|found|obtain\w*|loot\w*|take|buy|buys|bought|purchas\w*|price|cost|souls|chests?|corpses?|drop\w*|give|gives|receive|have|has)\b/i] },
        { key: 'ascetic', label: 'Ascetic', title: 'Ascetic - Bonfire Ascetic',
          urls: [/\/bonfire-ascetic/i],
          text: [/\bbonfire ascetics?\b/i],
          evidence: [/\b(?:use|using|used|need(?:s|ed)?|burn\w*|respawn\w*|reset|revive|get|gets|got|getting|pick(?:ed)? up|grab|find|found|obtain\w*|loot\w*|take|buy|buys|bought|purchas\w*|price|cost|souls|chests?|corpses?|drop\w*|trade|give|gives|spend|stock)\b/i] },
        { key: 'covenant', label: 'Covenant', title: 'Covenant - joining, discovering and ranking up',
          urls: [/way-of-blue|company-of-champions|heirs-of-the-sun|blue-sentinels|brotherhood-of-blood|bell-keepers|rat-king|pilgrims-of-dark|dragon-remnants/i],
          text: [/\bcovenants?\b/i, covenantNames],
          // joining, ranking or discovering a covenant - being invaded by its
          // members is not the same thing
          evidence: [/\b(?:join|joined|joining|joins|discover\w*|examine\w*|rank\w*|ranking|offer\w*|token|devotion|max out|pray\w*|pledge\w*|devote\w*)\b/i] },
        { key: 'gesture', label: 'Gesture', title: 'Gesture - the gestures of the Gesture Maestro list',
          urls: [/\/gestures?\b/i],
          // the Gesture Maestro checklist is nothing but the gesture list, so
          // every row in it is one
          sections: ['Gesture_Maestro'],
          text: [/\bgestures?\b/i],
          evidence: [/\b(?:learn|learns|learned|learning|taught|teach\w*|get|gets|got|getting|obtain\w*|receive\w*|use|using|perform\w*|examine\w*|show\w*|unlock\w*)\b/i] },
        { key: 'secret', label: 'Secret', title: 'Secret - illusory walls and hidden doors',
          text: [/\billusory walls?\b/i, /\billusion(?:ary)? walls?\b/i, /\bhidden (?:doors?|walls?|passages?)\b/i, /\bsecret (?:doors?|walls?|passages?)\b/i, /\binvisible walls?\b/i],
          // the row has to deal with the secret or describe what it hides;
          // walking past one is not the same thing
          evidence: [
              /\b(?:use|uses|using|used|open|opens|opened|opening|hit|hits|strike|reveal\w*|destroy\w*|smash\w*|break\w*|search\w*|check\w*|activate\w*|find|finding|found)\b/i,
              /\b(?:behind|under|inside|leads?|leading|contains?|hides?|conceals?)\b/i,
              /\bthere (?:is|are|will be|'s)\b/i
          ],
          exclude: [/\binvisible wall (?:watch|guard|warrior|knight|soldier)/i] },
        { key: 'memory', label: 'Memory', title: 'Memory - the Ashen Mist Heart memories',
          urls: [/\/memory-of/i],
          text: [/\bmemor(?:y|ies)\b/i],
          evidence: [/\b(?:enter|entering|enter\w*|go(?:es)? into|access\w*|examine\w*|complete\w*|finish\w*|explore\w*|return to|visit\w*|inside|use|using|ashen mist heart|transport\w*)\b/i],
          // a row that only mentions a memory already behind you is a note about
          // something else
          exclude: [/\b(?:already|previously)\s+(?:completed|finished|cleared|done)\b[^.]{0,40}\bmemor/i] }
    ];

    var uiStateKey = 'ds2_ui_state';

    // every section on the page, indexed so filtering can reach it cheaply
    var sections = [];

    // sections opened only to reveal matches; collapsed again when no filter
    // is active and never persisted, so the reader's own choices always win
    var autoExpanded = [];

    /*
     * View state (search box, chips, hide-completed) is kept out of the
     * profile data so a backup file only ever carries checkmarks. jStorage is
     * used when present, plain localStorage otherwise.
     */
    function readUiState() {
        try {
            if ($.jStorage) { return $.jStorage.get(uiStateKey, null); }
        } catch (e) { /* ignore */ }
        try {
            return JSON.parse(window.localStorage.getItem(uiStateKey));
        } catch (e) {
            return null;
        }
    }

    function saveUiState(patch) {
        var state = readUiState() || { search: '', filters: [] };
        $.each(patch, function(key, value) {
            state[key] = value;
        });
        try {
            if ($.jStorage) { $.jStorage.set(uiStateKey, state); }
        } catch (e) { /* ignore */ }
        try {
            window.localStorage.setItem(uiStateKey, JSON.stringify(state));
        } catch (e) { /* ignore */ }
    }

    // rows are judged sentence by sentence, so wording in one sentence can
    // never supply the evidence for a mention in another. Only punctuation
    // followed by a new sentence breaks the row up, which keeps "learn the
    // Have Mercy! gesture" whole.
    function splitSentences(text) {
        return text.split(/[.!?]+(?:\s+(?=[A-Z])|$)/);
    }

    // the slice of a sentence within `radius` characters of an anchor. Used by
    // rules that set `window`, so a name in one clause cannot borrow the verb
    // from another clause of the same sentence.
    function sliceAround(sentence, index, length, radius) {
        return sentence.slice(Math.max(0, index - radius),
                              Math.min(sentence.length, index + length + radius));
    }

    // every ±radius window around an anchor match in a sentence. A rule's
    // `text` patterns and its URL-matched link labels are both anchors.
    function anchorWindows(sentence, rule, links, radius) {
        var windows = [];
        var plain = sentence.toLowerCase();
        $.each(rule.text || [], function(i, regex) {
            var m = sentence.match(regex);
            if (m) { windows.push(sliceAround(sentence, m.index, m[0].length, radius)); }
        });
        $.each(links || [], function(i, link) {
            if (!link.label || plain.indexOf(link.label) === -1) { return; }
            var urlHit = false;
            $.each(rule.urls || [], function(j, regex) {
                if (regex.test(link.href)) { urlHit = true; }
            });
            if (!urlHit) { return; }
            // a URL says what the link is about, but a link text that
            // disagrees is a typo in the data: it must not smuggle the badge in
            if (rule.urlsText) {
                var labelOk = false;
                $.each(rule.urlsText, function(k, regex) {
                    if (regex.test(link.label)) { labelOk = true; }
                });
                if (!labelOk) { return; }
            }
            var idx = plain.indexOf(link.label);
            windows.push(sliceAround(sentence, idx, link.label.length, radius));
        });
        return windows;
    }

    function tagKeyItems() {
        $('li[data-id]').each(function() {
            var $entry = $(this);
            var $own = $entry.clone();
            $own.find('ul').remove();
            var text = $.trim($own.text().replace(/\s+/g, ' '));
            var sentences = splitSentences(text);
            // the section the row sits in, e.g. "Iron_Keep"
            var section = ($entry.closest('ul[id$="_col"]').attr('id') || '').replace(/_col$/, '');
            var links = [];
            $own.find('a').each(function() {
                links.push({
                    href: this.getAttribute('href') || '',
                    label: $.trim($(this).text().replace(/\s+/g, ' ')).toLowerCase()
                });
            });

            var matched = [];
            $.each(badgeRules, function(index, rule) {
                // a rule without evidence could only fire on a bare keyword
                if (!rule.evidence || rule.evidence.length === 0) { return; }

                // wording that proves this is a different thing wins outright
                var blocked = false;
                $.each(rule.exclude || [], function(i, regex) {
                    if (regex.test(text)) { blocked = true; }
                });
                if (blocked) { return; }

                // a rule may claim a whole section, e.g. the Gesture Maestro
                // checklist, whose rows are the gestures themselves
                var hit = !!rule.sections && $.inArray(section, rule.sections) >= 0;

                if (!hit) { $.each(sentences, function(i, sentence) {
                    // the sentence has to carry the thing itself: its name, or
                    // a link to its page whose own text sits in the sentence
                    var anchored = false;
                    $.each(rule.text || [], function(j, regex) {
                        if (regex.test(sentence)) { anchored = true; }
                    });
                    if (!anchored) {
                        var plain = sentence.toLowerCase();
                        $.each(links, function(j, link) {
                            if (!link.label || plain.indexOf(link.label) === -1) { return; }
                            var urlHit = false;
                            $.each(rule.urls || [], function(k, regex) {
                                if (regex.test(link.href)) { urlHit = true; }
                            });
                            if (!urlHit) { return; }
                            // a URL says what the link is about, but a link
                            // text that disagrees is a typo in the data: it
                            // must not smuggle the badge in
                            if (rule.urlsText) {
                                var labelOk = false;
                                $.each(rule.urlsText, function(k, regex) {
                                    if (regex.test(link.label)) { labelOk = true; }
                                });
                                if (!labelOk) { return; }
                            }
                            anchored = true;
                        });
                    }
                    if (!anchored) { return; }

                    // some names are shared with another thing - the rule gets
                    // to say whether this row is really its thing
                    if (rule.block && rule.block(sentence, section)) { return; }

                    // the action has to happen near the thing it acts on: in a
                    // long sentence a name in one clause must not borrow the
                    // verb from another (see rule.window)
                    var haystacks = [sentence];
                    if (rule.window) {
                        haystacks = anchorWindows(sentence, rule, links, rule.window);
                        if (haystacks.length === 0) { return; }
                    }

                    // ... and that same sentence has to act on it
                    $.each(rule.evidence, function(j, regex) {
                        $.each(haystacks, function(k, hay) {
                            if (regex.test(hay)) { hit = true; }
                        });
                    });
                }); }
                if (hit) { matched.push(rule); }
            });
            if (matched.length === 0) { return; }

            var $content = $entry.children('.checkbox').find('.item_content');
            if ($content.length === 0) { return; }

            var keys = [];
            var html = '';
            $.each(matched, function(i, rule) {
                keys.push(rule.key);
                html += '<span class="tag-badge tag-' + rule.key + '" title="' + rule.title + '">' + rule.label + '</span>';
            });
            $content.prepend(html);
            $entry.data('tags', keys);
        });
    }

    function indexSections() {
        sections = [];
        $('h3[id]').each(function() {
            var $header = $(this);
            var collapseHref = $header.find('a[href$="_col"]').attr('href');
            if (!collapseHref) { return; }
            var $list = $(collapseHref);
            if ($list.length === 0) { return; }

            var id = $header.attr('id');
            sections.push({
                id: id,
                $header: $header,
                $list: $list,
                $toc: $('a[href="#' + id + '"]').not('[data-toggle]').closest('li'),
                $pane: $header.closest('.tab-pane'),
                $track: null
            });
        });

        // the Checklists index is a bare list; give it the card styling
        // (every section list is also a direct child, so exclude those)
        $('#tabChecklists > ul').not('[id$="_col"]').addClass('table_of_contents');
    }

    function getSection(id) {
        for (var i = 0; i < sections.length; i++) {
            if (sections[i].id === id) { return sections[i]; }
        }
        return null;
    }

    function ensureProgressBars() {
        $.each(sections, function(index, section) {
            var $track = section.$header.next('.section-progress-track');
            if ($track.length === 0) {
                $track = $('<div class="section-progress-track"><div class="section-progress-bar"></div></div>');
                section.$header.after($track);
            }
            section.$track = $track;
        });
    }

    function activeFilterTags() {
        var tags = [];
        $('.chip-badge.active').each(function() {
            tags.push($(this).data('tag'));
        });
        return tags;
    }

    function rowMatches($entry, query, tags, hideCompleted) {
        if (hideCompleted && $entry.find('input[type="checkbox"]').first().prop('checked')) {
            return false;
        }
        if (query && $entry.text().toLowerCase().indexOf(query) === -1) {
            return false;
        }
        if (tags.length) {
            var entryTags = $entry.data('tags') || [];
            var hit = false;
            for (var i = 0; i < tags.length; i++) {
                if ($.inArray(tags[i], entryTags) !== -1) { hit = true; break; }
            }
            if (!hit) { return false; }
        }
        return true;
    }

    function applyFilters() {
        var query = $.trim($('#itemSearch').val() || '').toLowerCase();
        var tags = activeFilterTags();
        var filtering = (query.length > 0 || tags.length > 0);
        var hideCompleted = $('body').hasClass('hide_completed');
        var total = 0;
        var matches = 0;
        var paneMatches = {};
        var toExpand = [];

        $.each(sections, function(index, section) {
            var entries = section.$list.find('li[data-id]').get();
            var state = [];

            $.each(entries, function(i, el) {
                total++;
                state[i] = rowMatches($(el), query, tags, hideCompleted);
            });

            // keep a parent entry visible when only a sub-entry of it matches
            $.each(entries, function(i, el) {
                if (!state[i]) { return; }
                var $parent = $(el).parent().closest('li[data-id]');
                if ($parent.length === 0) { return; }
                var parentIndex = $.inArray($parent[0], entries);
                if (parentIndex !== -1) { state[parentIndex] = true; }
            });

            var sectionMatches = 0;
            $.each(entries, function(i, el) {
                if (state[i]) { sectionMatches++; }
                $(el).toggleClass('filtered-out', !state[i]);
            });

            var hideSection = filtering && sectionMatches === 0;
            section.$header.toggleClass('filtered-out', hideSection);
            section.$list.toggleClass('filtered-out', hideSection);
            if (section.$track) { section.$track.toggleClass('filtered-out', hideSection); }
            if (section.$toc.length) { section.$toc.toggleClass('filtered-out', hideSection); }

            if (!hideSection) {
                matches += sectionMatches;
                var paneId = section.$pane.attr('id') || '';
                paneMatches[paneId] = (paneMatches[paneId] || 0) + sectionMatches;

                if (filtering && !section.$list.hasClass('in')) {
                    toExpand.push(section);
                }
            }
        });

        if (filtering) {
            $.each(toExpand, function(index, section) {
                if ($.inArray(section.id, autoExpanded) === -1) { autoExpanded.push(section.id); }
                section.$list.collapse('show');
            });
        } else {
            $.each(autoExpanded, function(index, id) {
                var section = getSection(id);
                if (section) { section.$list.collapse('hide'); }
            });
            autoExpanded = [];
        }

        $('#chipRow').toggleClass('filtering', filtering);

        var $count = $('#filterCount');
        if (filtering) {
            $count.text(matches === 0 ? 'No matches' : matches + ' of ' + total + ' matches');
            $count.toggleClass('empty', matches === 0);
        } else {
            $count.text(total + ' items');
            $count.removeClass('empty');
        }

        // point the reader at tabs that hold matches they cannot see yet
        $('.navbar-nav a[data-toggle="tab"]').each(function() {
            var $tab = $(this);
            var paneId = ($tab.attr('href') || '').replace('#', '');
            var count = paneMatches[paneId] || 0;
            var $badge = $tab.children('.tab-match-count');
            if (filtering && count > 0 && !$tab.closest('li').hasClass('active')) {
                if ($badge.length === 0) { $badge = $('<span class="tab-match-count"></span>').appendTo($tab); }
                $badge.text(count);
            } else if ($badge.length) {
                $badge.remove();
            }
        });

        saveUiState({ search: $('#itemSearch').val() || '', filters: tags });
    }

    function updateToolbarOverall() {
        var $pill = $('#overallProgressPill');
        if ($pill.length === 0) { return; }

        var $total = $('.tab-pane.active').find('[id$="_overall_total"]').first();
        if ($total.length === 0) { $total = $('#playthrough_overall_total'); }

        var text = $.trim($total.text());
        $pill.text(text);
        $pill.toggleClass('done', text === 'DONE');
    }

    function restoreUiState() {
        var state = readUiState();
        if (state) {
            if (state.filters && state.filters.length) {
                $.each(state.filters, function(index, tag) {
                    $('.chip-badge[data-tag="' + tag + '"]').addClass('active');
                });
            }
            if (state.search) {
                $('#itemSearch').val(state.search);
            }
            if (state.hideCompleted) {
                $('body').addClass('hide_completed');
                $('#toggleHideCompleted').prop('checked', true).closest('label').addClass('active');
            }
        }
        applyFilters();
    }

    function debounce(fn, wait) {
        var timer = null;
        return function() {
            var context = this;
            var args = arguments;
            if (timer) { window.clearTimeout(timer); }
            timer = window.setTimeout(function() {
                timer = null;
                fn.apply(context, args);
            }, wait);
        };
    }

    /*
     * ------------------------------------------------------------------
     * Toolbar visibility
     * ------------------------------------------------------------------
     * The toolbar is about the checklists (progress, search, filters), so it
     * is hidden on the reference-only tabs instead of sitting there empty.
     * display:none removes its margins too, so no gap is left behind.
     */
    var referencePanes = { tabInformation: true, tabHelp: true };

    function syncToolbarVisibility(paneId) {
        $('.toolbar').toggleClass('toolbar-hidden', referencePanes[paneId] === true);
    }

    function bindToolbarVisibility() {
        // click keeps it in step with Bootstrap's own tab handling, and
        // shown.bs.tab covers keyboard or script-driven tab changes
        $('a[data-toggle="tab"]').on('click', function() {
            syncToolbarVisibility(($(this).attr('href') || '').replace('#', ''));
        });
        $('a[data-toggle="tab"]').on('shown.bs.tab', function() {
            syncToolbarVisibility(($(this).attr('href') || '').replace('#', ''));
        });
        syncToolbarVisibility($('.tab-pane.active').attr('id') || '');
    }

    function bindFilterControls() {
        $('.chip-badge').on('click', function() {
            $(this).toggleClass('active');
            applyFilters();
        });

        $('#clearFilters').on('click', function() {
            $('.chip-badge').removeClass('active');
            $('#itemSearch').val('');
            applyFilters();
        });

        $('#itemSearch').on('input', debounce(applyFilters, 120));

        $('a[data-toggle="tab"]').on('shown.bs.tab', function() {
            updateToolbarOverall();
            applyFilters();
        });

        // a manual collapse is the reader's own choice, so stop tracking it
        $('a[href$="_col"]').on('click', function() {
            var id = ($(this).attr('href') || '').replace('#', '').replace(/_col$/, '');
            autoExpanded = $.grep(autoExpanded, function(value) { return value !== id; });
        });
    }

})( jQuery );