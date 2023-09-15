import { IBasicSession } from "node-opcua-pseudo-session";
import { ExtraDataTypeManager } from "./extra_data_type_manager";
/**
 * @private
 */
export declare function serverImplementsDataTypeDefinition(session: IBasicSession): Promise<boolean>;
export declare function populateDataTypeManager(session: IBasicSession, dataTypeManager: ExtraDataTypeManager): Promise<void>;
