"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AutoIncrementID = exports.AutoIncrementIDSkipSymbol = exports.AutoIncrementSimple = exports.isNullOrUndefined = void 0;
const tslib_1 = require("tslib");
const mongoose = require("mongoose");
const logSettings_1 = require("./logSettings");
const DEFAULT_INCREMENT = 1;
/**
 * Because since node 4.0.0 the internal util.is* functions got deprecated
 * @param val Any value to test if null or undefined
 */
function isNullOrUndefined(val) {
    return val === null || val === undefined;
}
exports.isNullOrUndefined = isNullOrUndefined;
/**
 * The Plugin - Simple version
 * Increments an value each time it is saved
 * @param schema The Schema
 * @param options The Options
 */
function AutoIncrementSimple(schema, options) {
    // convert normal object into an array
    const fields = Array.isArray(options) ? options : [options];
    logSettings_1.logger.info('Initilaize AutoIncrement for an schema with %d fields to increment', fields.length);
    if (fields.length <= 0) {
        throw new Error('Options with at least one field are required!');
    }
    // check if all fields are valid
    for (const field of fields) {
        const schemaField = schema.path(field.field);
        // check if the field is even existing
        if (isNullOrUndefined(schemaField)) {
            throw new Error(`Field "${field.field}" does not exists on the Schema!`);
        }
        // check if the field is an number
        if (!(schemaField instanceof mongoose.Schema.Types.Number)) {
            throw new Error(`Field "${field.field}" is not an SchemaNumber!`);
        }
        if (isNullOrUndefined(field.incrementBy)) {
            logSettings_1.logger.info('Field "%s" does not have an incrementBy defined, defaulting to %d', field.field, DEFAULT_INCREMENT);
            field.incrementBy = DEFAULT_INCREMENT;
        }
    }
    // to have an name to the function if debugging
    schema.pre('save', function AutoIncrementPreSaveSimple() {
        if (!this.isNew) {
            logSettings_1.logger.info('Starting to increment "%s"', this.constructor.modelName);
            for (const field of fields) {
                logSettings_1.logger.info('Incrementing "%s" by %d', field.field, field.incrementBy);
                this[field.field] += field.incrementBy;
            }
        }
    });
}
exports.AutoIncrementSimple = AutoIncrementSimple;
/** The Schema used for the trackers */
const IDSchema = new mongoose.Schema({
    field: String,
    modelName: String,
    count: Number,
    reference_values: Object
}, { versionKey: false });
IDSchema.index({ field: 1, modelName: 1, reference_values: 1 }, { unique: true });
exports.AutoIncrementIDSkipSymbol = Symbol('AutoIncrementIDSkip');
/**
 * The Plugin - ID
 * Increments an counter in an tracking collection
 * @param schema The Schema
 * @param options The Options
 */
function AutoIncrementID(schema, options) {
    /** The Options with default options applied */
    const opt = Object.assign({ field: '_id', incrementBy: DEFAULT_INCREMENT, trackerCollection: 'identitycounters', trackerModelName: 'identitycounter', startAt: 0, reference_fields: [] }, options);
    // check if the field is an number
    if (!(schema.path(opt.field) instanceof mongoose.Schema.Types.Number)) {
        throw new Error(`Field "${opt.field}" is not an SchemaNumber!`);
    }
    // Check that reference fields exist in the model
    for (const field of opt.reference_fields) {
        if (!(schema.path(field) != null)) {
            throw new Error(`Reference field "${field}" does not exist!`);
        }
    }
    let model;
    // Return the values of the reference fields in a given doc
    const _getCounterReferenceField = (doc) => {
        const referenceValues = {};
        // Populate the reference object with reference values
        for (const field of opt.reference_fields) {
            referenceValues[field] = doc[field];
        }
        return referenceValues;
    };
    logSettings_1.logger.info('AutoIncrementID called with options %O', opt);
    schema.pre('save', function AutoIncrementPreSaveID() {
        var _a;
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            logSettings_1.logger.info('AutoIncrementID PreSave');
            const modelName = this.constructor.modelName;
            // Get reference values for doc
            const referenceValues = _getCounterReferenceField(this);
            if (!model) {
                logSettings_1.logger.info('Creating idtracker model named "%s"', opt.trackerModelName);
                // needs to be done, otherwise "undefiend" error if the plugin is used in an sub-document
                const db = (_a = this.db) !== null && _a !== void 0 ? _a : this.ownerDocument().db;
                model = db.model(opt.trackerModelName, IDSchema, opt.trackerCollection);
                // test if the counter document already exists
                const counter = yield model
                    .findOne({
                    modelName: modelName,
                    field: opt.field,
                    reference_values: referenceValues
                })
                    .lean()
                    .exec();
                if (!counter) {
                    yield model.create({
                        modelName: modelName,
                        field: opt.field,
                        count: opt.startAt - opt.incrementBy,
                        reference_values: referenceValues
                    });
                }
            }
            if (!this.isNew) {
                logSettings_1.logger.info('Document is not new, not incrementing');
                return;
            }
            if (typeof this[exports.AutoIncrementIDSkipSymbol] === 'boolean' && exports.AutoIncrementIDSkipSymbol) {
                logSettings_1.logger.info('Symbol "AutoIncrementIDSkipSymbol" is set to "true", skipping');
                return;
            }
            const leandoc = (yield model
                .findOneAndUpdate({
                field: opt.field,
                modelName: modelName,
                reference_values: referenceValues
            }, {
                $inc: { count: opt.incrementBy },
            }, {
                new: true,
                fields: { count: 1, _id: 0 },
                upsert: true,
                setDefaultsOnInsert: true,
            })
                .lean()
                .exec()); // it seems like "FindAndModifyWriteOpResultObject" does not have a "count" property
            if (isNullOrUndefined(leandoc)) {
                throw new Error(`"findOneAndUpdate" incrementing count failed for "${modelName}" on field "${opt.field}"`);
            }
            logSettings_1.logger.info('Setting "%s" to "%d"', opt.field, leandoc.count);
            this[opt.field] = leandoc.count;
            return;
        });
    });
}
exports.AutoIncrementID = AutoIncrementID;
tslib_1.__exportStar(require("./types"), exports);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXV0b0luY3JlbWVudC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NyYy9hdXRvSW5jcmVtZW50LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7QUFBQSxxQ0FBcUM7QUFDckMsK0NBQXVDO0FBR3ZDLE1BQU0saUJBQWlCLEdBQUcsQ0FBQyxDQUFDO0FBRTVCOzs7R0FHRztBQUNILFNBQWdCLGlCQUFpQixDQUFDLEdBQVk7SUFDNUMsT0FBTyxHQUFHLEtBQUssSUFBSSxJQUFJLEdBQUcsS0FBSyxTQUFTLENBQUM7QUFDM0MsQ0FBQztBQUZELDhDQUVDO0FBRUQ7Ozs7O0dBS0c7QUFDSCxTQUFnQixtQkFBbUIsQ0FDakMsTUFBNEIsRUFDNUIsT0FBa0U7SUFFbEUsc0NBQXNDO0lBQ3RDLE1BQU0sTUFBTSxHQUFpQyxLQUFLLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUM7SUFDMUYsb0JBQU0sQ0FBQyxJQUFJLENBQUMsb0VBQW9FLEVBQUUsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBRWpHLElBQUksTUFBTSxDQUFDLE1BQU0sSUFBSSxDQUFDLEVBQUU7UUFDdEIsTUFBTSxJQUFJLEtBQUssQ0FBQywrQ0FBK0MsQ0FBQyxDQUFDO0tBQ2xFO0lBRUQsZ0NBQWdDO0lBQ2hDLEtBQUssTUFBTSxLQUFLLElBQUksTUFBTSxFQUFFO1FBQzFCLE1BQU0sV0FBVyxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBRTdDLHNDQUFzQztRQUN0QyxJQUFJLGlCQUFpQixDQUFDLFdBQVcsQ0FBQyxFQUFFO1lBQ2xDLE1BQU0sSUFBSSxLQUFLLENBQUMsVUFBVSxLQUFLLENBQUMsS0FBSyxrQ0FBa0MsQ0FBQyxDQUFDO1NBQzFFO1FBQ0Qsa0NBQWtDO1FBQ2xDLElBQUksQ0FBQyxDQUFDLFdBQVcsWUFBWSxRQUFRLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsRUFBRTtZQUMxRCxNQUFNLElBQUksS0FBSyxDQUFDLFVBQVUsS0FBSyxDQUFDLEtBQUssMkJBQTJCLENBQUMsQ0FBQztTQUNuRTtRQUVELElBQUksaUJBQWlCLENBQUMsS0FBSyxDQUFDLFdBQVcsQ0FBQyxFQUFFO1lBQ3hDLG9CQUFNLENBQUMsSUFBSSxDQUFDLG1FQUFtRSxFQUFFLEtBQUssQ0FBQyxLQUFLLEVBQUUsaUJBQWlCLENBQUMsQ0FBQztZQUNqSCxLQUFLLENBQUMsV0FBVyxHQUFHLGlCQUFpQixDQUFDO1NBQ3ZDO0tBQ0Y7SUFDRCwrQ0FBK0M7SUFDL0MsTUFBTSxDQUFDLEdBQUcsQ0FBQyxNQUFNLEVBQUUsU0FBUywwQkFBMEI7UUFDcEQsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLEVBQUU7WUFDZixvQkFBTSxDQUFDLElBQUksQ0FBQyw0QkFBNEIsRUFBRyxJQUFJLENBQUMsV0FBbUMsQ0FBQyxTQUFTLENBQUMsQ0FBQztZQUMvRixLQUFLLE1BQU0sS0FBSyxJQUFJLE1BQU0sRUFBRTtnQkFDMUIsb0JBQU0sQ0FBQyxJQUFJLENBQUMseUJBQXlCLEVBQUUsS0FBSyxDQUFDLEtBQUssRUFBRSxLQUFLLENBQUMsV0FBVyxDQUFDLENBQUM7Z0JBQ3ZFLElBQUksQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLElBQUksS0FBSyxDQUFDLFdBQVcsQ0FBQzthQUN4QztTQUNGO0lBQ0gsQ0FBQyxDQUFDLENBQUM7QUFDTCxDQUFDO0FBeENELGtEQXdDQztBQUVELHVDQUF1QztBQUN2QyxNQUFNLFFBQVEsR0FBRyxJQUFJLFFBQVEsQ0FBQyxNQUFNLENBQWdDO0lBQ2xFLEtBQUssRUFBRSxNQUFNO0lBQ2IsU0FBUyxFQUFFLE1BQU07SUFDakIsS0FBSyxFQUFFLE1BQU07SUFDYixnQkFBZ0IsRUFBRSxNQUFNO0NBQ3pCLEVBQUUsRUFBRSxVQUFVLEVBQUUsS0FBSyxFQUFFLENBQUMsQ0FBQztBQUMxQixRQUFRLENBQUMsS0FBSyxDQUFDLEVBQUUsS0FBSyxFQUFFLENBQUMsRUFBRSxTQUFTLEVBQUUsQ0FBQyxFQUFFLGdCQUFnQixFQUFFLENBQUMsRUFBRSxFQUFFLEVBQUUsTUFBTSxFQUFFLElBQUksRUFBRSxDQUFDLENBQUM7QUFFckUsUUFBQSx5QkFBeUIsR0FBRyxNQUFNLENBQUMscUJBQXFCLENBQUMsQ0FBQztBQUV2RTs7Ozs7R0FLRztBQUNILFNBQWdCLGVBQWUsQ0FBQyxNQUE0QixFQUFFLE9BQStCO0lBQzNGLCtDQUErQztJQUMvQyxNQUFNLEdBQUcsbUJBQ1AsS0FBSyxFQUFFLEtBQUssRUFDWixXQUFXLEVBQUUsaUJBQWlCLEVBQzlCLGlCQUFpQixFQUFFLGtCQUFrQixFQUNyQyxnQkFBZ0IsRUFBRSxpQkFBaUIsRUFDbkMsT0FBTyxFQUFFLENBQUMsRUFDVixnQkFBZ0IsRUFBRSxFQUFFLElBQ2pCLE9BQU8sQ0FDWCxDQUFDO0lBRUYsa0NBQWtDO0lBQ2xDLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxZQUFZLFFBQVEsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxFQUFFO1FBQ3JFLE1BQU0sSUFBSSxLQUFLLENBQUMsVUFBVSxHQUFHLENBQUMsS0FBSywyQkFBMkIsQ0FBQyxDQUFDO0tBQ2pFO0lBRUQsaURBQWlEO0lBQ2pELEtBQUssTUFBTSxLQUFLLElBQUksR0FBRyxDQUFDLGdCQUFnQixFQUFFO1FBQ3hDLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksSUFBSSxDQUFDLEVBQUU7WUFDakMsTUFBTSxJQUFJLEtBQUssQ0FBQyxvQkFBb0IsS0FBSyxtQkFBbUIsQ0FBQyxDQUFDO1NBQy9EO0tBQ0Y7SUFFRCxJQUFJLEtBQW9ELENBQUM7SUFFekQsMkRBQTJEO0lBQzNELE1BQU0seUJBQXlCLEdBQUcsQ0FBQyxHQUFzQixFQUFVLEVBQUU7UUFDbkUsTUFBTSxlQUFlLEdBQVcsRUFBRSxDQUFDO1FBRW5DLHNEQUFzRDtRQUN0RCxLQUFLLE1BQU0sS0FBSyxJQUFJLEdBQUcsQ0FBQyxnQkFBZ0IsRUFBRTtZQUN4QyxlQUFlLENBQUMsS0FBSyxDQUFDLEdBQUcsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDO1NBQ3JDO1FBRUQsT0FBTyxlQUFlLENBQUM7SUFDekIsQ0FBQyxDQUFDO0lBRUYsb0JBQU0sQ0FBQyxJQUFJLENBQUMsd0NBQXdDLEVBQUUsR0FBRyxDQUFDLENBQUM7SUFFM0QsTUFBTSxDQUFDLEdBQUcsQ0FBQyxNQUFNLEVBQUUsU0FBZSxzQkFBc0I7OztZQUN0RCxvQkFBTSxDQUFDLElBQUksQ0FBQyx5QkFBeUIsQ0FBQyxDQUFDO1lBRXZDLE1BQU0sU0FBUyxHQUFZLElBQUksQ0FBQyxXQUFtQixDQUFDLFNBQVMsQ0FBQztZQUU5RCwrQkFBK0I7WUFDL0IsTUFBTSxlQUFlLEdBQUcseUJBQXlCLENBQUMsSUFBSSxDQUFDLENBQUM7WUFFeEQsSUFBSSxDQUFDLEtBQUssRUFBRTtnQkFDVixvQkFBTSxDQUFDLElBQUksQ0FBQyxxQ0FBcUMsRUFBRSxHQUFHLENBQUMsZ0JBQWdCLENBQUMsQ0FBQztnQkFDekUseUZBQXlGO2dCQUN6RixNQUFNLEVBQUUsU0FBd0IsSUFBSSxDQUFDLEVBQUUsbUNBQUssSUFBWSxDQUFDLGFBQWEsRUFBRSxDQUFDLEVBQUUsQ0FBQztnQkFDNUUsS0FBSyxHQUFHLEVBQUUsQ0FBQyxLQUFLLENBQWdDLEdBQUcsQ0FBQyxnQkFBZ0IsRUFBRSxRQUFRLEVBQUUsR0FBRyxDQUFDLGlCQUFpQixDQUFDLENBQUM7Z0JBQ3ZHLDhDQUE4QztnQkFDOUMsTUFBTSxPQUFPLEdBQUcsTUFBTSxLQUFLO3FCQUN4QixPQUFPLENBQUM7b0JBQ1AsU0FBUyxFQUFFLFNBQVM7b0JBQ3BCLEtBQUssRUFBRSxHQUFHLENBQUMsS0FBSztvQkFDaEIsZ0JBQWdCLEVBQUUsZUFBZTtpQkFDbEMsQ0FBQztxQkFDRCxJQUFJLEVBQUU7cUJBQ04sSUFBSSxFQUFFLENBQUM7Z0JBQ1YsSUFBSSxDQUFDLE9BQU8sRUFBRTtvQkFDWixNQUFNLEtBQUssQ0FBQyxNQUFNLENBQUM7d0JBQ2pCLFNBQVMsRUFBRSxTQUFTO3dCQUNwQixLQUFLLEVBQUUsR0FBRyxDQUFDLEtBQUs7d0JBQ2hCLEtBQUssRUFBRSxHQUFHLENBQUMsT0FBTyxHQUFHLEdBQUcsQ0FBQyxXQUFXO3dCQUNwQyxnQkFBZ0IsRUFBRSxlQUFlO3FCQUNsQyxDQUFDLENBQUM7aUJBQ0o7YUFDRjtZQUVELElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxFQUFFO2dCQUNmLG9CQUFNLENBQUMsSUFBSSxDQUFDLHVDQUF1QyxDQUFDLENBQUM7Z0JBRXJELE9BQU87YUFDUjtZQUVELElBQUksT0FBTyxJQUFJLENBQUMsaUNBQXlCLENBQUMsS0FBSyxTQUFTLElBQUksaUNBQXlCLEVBQUU7Z0JBQ3JGLG9CQUFNLENBQUMsSUFBSSxDQUFDLCtEQUErRCxDQUFDLENBQUM7Z0JBRTdFLE9BQU87YUFDUjtZQUVELE1BQU0sT0FBTyxHQUFzQixDQUFDLE1BQU0sS0FBSztpQkFDNUMsZ0JBQWdCLENBQ2Y7Z0JBQ0UsS0FBSyxFQUFFLEdBQUcsQ0FBQyxLQUFLO2dCQUNoQixTQUFTLEVBQUUsU0FBUztnQkFDcEIsZ0JBQWdCLEVBQUUsZUFBZTthQUNsQyxFQUNEO2dCQUNFLElBQUksRUFBRSxFQUFFLEtBQUssRUFBRSxHQUFHLENBQUMsV0FBVyxFQUFFO2FBQ2pDLEVBQ0Q7Z0JBQ0UsR0FBRyxFQUFFLElBQUk7Z0JBQ1QsTUFBTSxFQUFFLEVBQUUsS0FBSyxFQUFFLENBQUMsRUFBRSxHQUFHLEVBQUUsQ0FBQyxFQUFFO2dCQUM1QixNQUFNLEVBQUUsSUFBSTtnQkFDWixtQkFBbUIsRUFBRSxJQUFJO2FBQzFCLENBQ0Y7aUJBQ0EsSUFBSSxFQUFFO2lCQUNOLElBQUksRUFBRSxDQUFRLENBQUMsQ0FBQyxvRkFBb0Y7WUFFdkcsSUFBSSxpQkFBaUIsQ0FBQyxPQUFPLENBQUMsRUFBRTtnQkFDOUIsTUFBTSxJQUFJLEtBQUssQ0FBQyxxREFBcUQsU0FBUyxlQUFlLEdBQUcsQ0FBQyxLQUFLLEdBQUcsQ0FBQyxDQUFDO2FBQzVHO1lBRUQsb0JBQU0sQ0FBQyxJQUFJLENBQUMsc0JBQXNCLEVBQUUsR0FBRyxDQUFDLEtBQUssRUFBRSxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUM7WUFDOUQsSUFBSSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsR0FBRyxPQUFPLENBQUMsS0FBSyxDQUFDO1lBRWhDLE9BQU87O0tBQ1IsQ0FBQyxDQUFDO0FBQ0wsQ0FBQztBQWpIRCwwQ0FpSEM7QUFFRCxrREFBd0IifQ==